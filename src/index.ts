#!/usr/bin/env node

// Import essential libraries
import { Command } from "commander";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora from "ora";
import inquirer from "inquirer";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import ffmpeg from "fluent-ffmpeg";
import ytdl from "ytdl-core";
import Anthropic from "@anthropic-ai/sdk";
import { OpenAI } from "openai";
import * as whisper from "@xenova/transformers";
import boxen from "boxen";
import gradient from "gradient-string";
import updateNotifier from "update-notifier";
import os from "os";
import pkg from "../package.json" with { type: "json" };
import { VideoOptions, FormatMap } from "./types.js";
import { exec } from "child_process";
import { createPDFfromHTML } from "./createPDFHtml.js";
import figures from "figures";
import terminalLink from "terminal-link";
import { getModel, MODELS } from "./models.js";
import { ui } from "./ui.js";

// Environment setup
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Completely suppress ALL ONNX warnings by redirecting stderr
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

process.stderr.write = ((data: string | Uint8Array) => {
  // Check if this is an ONNX warning
  const strData = String(data);
  if (
    strData.includes("onnxruntime") ||
    strData.includes("Removing initializer") ||
    strData.includes("CleanUnusedInitializers") ||
    strData.includes("whisper") ||
    strData.includes("transformers")
  ) {
    // Silently drop ONNX warnings
    return true;
  }
  return originalStderrWrite(data);
}) as any;

// Check for updates
const notifier = updateNotifier({ pkg });
notifier.notify();

// Initialize AI clients
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

const program = new Command();

// Update the displayIntro function
const displayIntro = (): void => {
  ui.clearScreen();
  ui.displayLogo();
  ui.displayWelcome(pkg.version);
};

/**
 * Process video file or URL and generate notes
 */
async function processVideo(options: VideoOptions): Promise<string> {
  try {
    // Step 1: Analyze video
    ui.startSpinner("Analyzing video source...");

    const isYouTubeUrl =
      options.input.includes("youtube.com") ||
      options.input.includes("youtu.be");

    let videoPath: string;

    if (isYouTubeUrl) {
      // Try ytdl-core first, then fall back to youtube-dl if available
      try {
        ui.updateSpinner("Downloading YouTube video...");
        videoPath = await downloadYouTubeVideo(options.input);
      } catch (ytdlError) {
        ui.updateSpinner("Trying alternative download method...");

        try {
          videoPath = await downloadWithYoutubeDl(options.input);
        } catch (ytError) {
          ui.spinnerFail(
            `Could not download YouTube video: ${(ytError as Error).message}`
          );
          throw new Error(
            `Could not download YouTube video: ${(ytError as Error).message}`
          );
        }
      }
    } else {
      videoPath = options.input;
    }

    ui.spinnerSuccess("Video source prepared successfully");

    // Step 2: Extract audio from video
    ui.startSpinner("Extracting audio from video...");

    let audioPath;
    let transcript = "";

    try {
      audioPath = await extractAudioFromVideo(videoPath);
      ui.spinnerSuccess("Audio extracted successfully");

      // Step 3: Transcribe audio
      ui.startSpinner("Transcribing audio content...");
      try {
        transcript = await transcribeAudio(audioPath);
        ui.spinnerSuccess("Transcription completed");
      } catch (audioError) {
        ui.spinnerWarning(
          `Transcription issue: ${(audioError as Error).message}`
        );
        transcript =
          "[This video appears to have no audio content to transcribe]";
        ui.startSpinner("Proceeding without audio");
        ui.spinnerSuccess("Ready to generate notes");
      }
    } catch (audioError) {
      ui.spinnerWarning(
        `Audio extraction issue: ${(audioError as Error).message}`
      );
      ui.startSpinner("Proceeding with empty transcript...");
      transcript =
        "[This video appears to have no audio content to transcribe]";
      ui.spinnerSuccess("Ready to generate notes");
    }

    // Step 4: Generate intelligent notes
    ui.startSpinner("Creating intelligent notes from content...");

    const notes = await generateNotes(transcript, options);
    ui.spinnerSuccess("Notes generated successfully");

    // Step 5: Create PDF
    ui.startSpinner("Creating beautiful PDF document...");

    const pdfPath = await createPDF(notes, options);
    ui.spinnerSuccess("PDF created successfully");

    // Clean up temporary files
    if (isYouTubeUrl && videoPath) {
      try {
        fs.unlinkSync(videoPath);
      } catch (err) {
        // Silently handle cleanup errors
      }
    }
    if (audioPath) {
      try {
        fs.unlinkSync(audioPath);
      } catch (err) {
        // Silently handle cleanup errors
      }
    }

    // Show success with clickable link to PDF file
    ui.showSuccess(
      "Success",
      `Notes generated successfully!\n\nPDF saved to: ${pdfPath}`,
      { text: "Open PDF", url: `file://${pdfPath}` }
    );

    return pdfPath;
  } catch (error: unknown) {
    ui.showError("Error", (error as Error).message);
    throw error;
  }
}

/**
 * Download YouTube video with beautiful progress bar
 */
async function downloadYouTubeVideo(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      // Create temp file path
      const tempDir = os.tmpdir();
      const videoPath = path.join(tempDir, `video_${Date.now()}.mp4`);

      // Try to get video info first to validate URL
      ytdl
        .getInfo(url)
        .then((info) => {
          const videoTitle = info.videoDetails.title;
          const videoLengthSeconds = parseInt(info.videoDetails.lengthSeconds);

          ui.startSpinner(
            `Preparing download: ${videoTitle.substring(0, 40)}${videoTitle.length > 40 ? "..." : ""}`
          );

          // Get the best format that has both audio and video
          const format = ytdl.chooseFormat(info.formats, {
            quality: "highest",
            filter: (format) =>
              format.hasAudio && format.hasVideo && format.container === "mp4",
          });

          if (!format) {
            // Try a more lenient format selection if the first attempt fails
            const fallbackFormat = ytdl.chooseFormat(info.formats, {
              quality: "134", // Try 360p video
              filter: (format) => format.hasAudio || format.hasVideo,
            });

            if (!fallbackFormat) {
              ui.spinnerFail("No suitable video format found");
              reject(new Error("No suitable video format found"));
              return;
            }

            ui.stopSpinner();
            ui.startProgressBar(100, "Downloading video");

            let downloadedPercent = 0;

            // Create stream from format
            const stream = ytdl.downloadFromInfo(info, {
              format: fallbackFormat,
            });

            stream.on("progress", (_, downloaded, total) => {
              const percent = Math.floor((downloaded / total) * 100);
              if (percent > downloadedPercent) {
                downloadedPercent = percent;
                ui.updateProgressBar(percent);
              }
            });

            stream
              .pipe(fs.createWriteStream(videoPath))
              .on("finish", () => {
                ui.stopProgressBar();
                ui.spinnerSuccess("Download complete");
                resolve(videoPath);
              })
              .on("error", (err) => {
                ui.stopProgressBar();
                ui.spinnerFail(`Download failed: ${err.message}`);
                reject(new Error(`Download failed: ${err.message}`));
              });
          } else {
            // Use the best format found
            ui.stopSpinner();
            ui.startProgressBar(100, "Downloading video");

            let downloadedPercent = 0;

            const stream = ytdl.downloadFromInfo(info, { format: format });

            stream.on("progress", (_, downloaded, total) => {
              const percent = Math.floor((downloaded / total) * 100);
              if (percent > downloadedPercent) {
                downloadedPercent = percent;
                ui.updateProgressBar(percent);
              }
            });

            stream
              .pipe(fs.createWriteStream(videoPath))
              .on("finish", () => {
                // Verify file exists and has content
                if (
                  fs.existsSync(videoPath) &&
                  fs.statSync(videoPath).size > 0
                ) {
                  ui.stopProgressBar();
                  ui.spinnerSuccess("Download complete");
                  resolve(videoPath);
                } else {
                  ui.stopProgressBar();
                  ui.spinnerFail("Downloaded file is empty or missing");
                  reject(new Error("Downloaded file is empty or missing"));
                }
              })
              .on("error", (err) => {
                ui.stopProgressBar();
                ui.spinnerFail(`Download failed: ${err.message}`);
                reject(new Error(`Download failed: ${err.message}`));
              });
          }
        })
        .catch((err) => {
          ui.spinnerFail(`Failed to fetch video info: ${err.message}`);
          reject(new Error(`Failed to fetch video info: ${err.message}`));
        });
    } catch (error: unknown) {
      ui.spinnerFail(`YouTube download error: ${(error as Error).message}`);
      reject(new Error(`YouTube download error: ${(error as Error).message}`));
    }
  });
}

/**
 * Alternative YouTube download using yt-dlp
 */
async function downloadWithYoutubeDl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempDir = os.tmpdir();
    const outputPath = path.join(tempDir, `video_${Date.now()}.mp4`);

    const downloadSpinner = ora({
      text: chalk.blue("Downloading with yt-dlp..."),
      spinner: "dots",
    }).start();

    exec(
      `yt-dlp -f "best[height<=480]" -o "${outputPath}" "${url}"`,
      (error, stdout, stderr) => {
        if (error) {
          downloadSpinner.fail(chalk.red(`yt-dlp failed: ${error.message}`));
          reject(new Error(`yt-dlp failed: ${error.message}`));
          return;
        }

        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          downloadSpinner.succeed(chalk.green("Download complete with yt-dlp"));
          resolve(outputPath);
        } else {
          downloadSpinner.fail(
            chalk.red("yt-dlp download failed or file is empty")
          );
          reject(new Error("yt-dlp download failed or file is empty"));
        }
      }
    );
  });
}

/**
 * Extract audio from video file
 */
async function extractAudioFromVideo(videoPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    // First check if the video has an audio stream
    ffmpeg.ffprobe(videoPath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to probe video file: ${err.message}`));
        return;
      }

      // Check if the video has any audio streams
      const audioStreams = metadata.streams.filter(
        (stream) => stream.codec_type === "audio"
      );

      if (audioStreams.length === 0) {
        const noAudioSpinner = ora({
          text: chalk.yellow(
            "Video has no audio streams. Creating empty audio file..."
          ),
          spinner: "dots",
        }).start();

        // Create an empty audio file (1 second of silence)
        const timestamp = Date.now();
        const randomSuffix = Math.floor(Math.random() * 10000);
        const audioFileName = `audio_${timestamp}_${randomSuffix}.mp3`;
        const audioPath = path.join(os.tmpdir(), audioFileName);

        ffmpeg()
          .input("anullsrc")
          .inputOptions(["-f", "lavfi"])
          .audioCodec("libmp3lame")
          .audioBitrate("128k")
          .duration(1)
          .format("mp3")
          .on("error", (err) => {
            noAudioSpinner.fail(
              chalk.red(`Failed to create empty audio file: ${err.message}`)
            );
            reject(
              new Error(`Failed to create empty audio file: ${err.message}`)
            );
          })
          .on("end", () => {
            noAudioSpinner.succeed(chalk.green("Created silent audio file"));
            resolve(audioPath);
          })
          .save(audioPath);

        return;
      }

      // Video has audio streams, proceed with extraction
      const timestamp = Date.now();
      const randomSuffix = Math.floor(Math.random() * 10000);
      const audioFileName = `audio_${timestamp}_${randomSuffix}.mp3`;
      const audioPath = path.join(os.tmpdir(), audioFileName);

      // Ensure temp directory is writable
      try {
        const audioDir = path.dirname(audioPath);
        if (!fs.existsSync(audioDir)) {
          fs.mkdirSync(audioDir, { recursive: true });
        }
        fs.accessSync(audioDir, fs.constants.W_OK);
      } catch (err) {
        reject(
          new Error(`No write permission to temp directory: ${os.tmpdir()}`)
        );
        return;
      }

      ffmpeg(videoPath)
        .noVideo()
        .audioCodec("libmp3lame")
        .audioBitrate("128k")
        .format("mp3")
        .outputOptions("-y")
        .on("error", (err) => {
          reject(new Error(`Failed to extract audio: ${err.message}`));
        })
        .on("end", () => {
          if (fs.existsSync(audioPath) && fs.statSync(audioPath).size > 0) {
            resolve(audioPath);
          } else {
            reject(
              new Error("FFmpeg completed but output file is missing or empty")
            );
          }
        })
        .save(audioPath);
    });
  });
}

/**
 * Transcribe audio using Whisper with live updates
 */
async function transcribeAudio(audioPath: string): Promise<string> {
  try {
    // Initialize the Whisper speech recognition pipeline
    const { pipeline, env } = whisper as any;
    env.allowLocalModels = true;
    env.backends.onnx.wasm.numThreads = 1;

    ui.updateSpinner("Loading transcription model...");

    // Load the model (this may take a moment)
    const transcriber = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny.en"
    );

    ui.updateSpinner("Converting audio format...");

    // Convert audio file to raw PCM data
    const tempFile = audioPath + ".pcm";
    await new Promise<void>((resolve, reject) => {
      ffmpeg(audioPath)
        .outputOptions([
          "-f",
          "s16le", // raw PCM 16-bit little endian
          "-acodec",
          "pcm_s16le", // PCM codec
          "-ar",
          "16000", // 16 kHz sample rate
          "-ac",
          "1", // mono channel
        ])
        .output(tempFile)
        .on("end", () => resolve())
        .on("error", (err) =>
          reject(new Error(`FFmpeg conversion failed: ${err.message}`))
        )
        .run();
    });

    ui.updateSpinner("Processing audio...");

    const buffer = fs.readFileSync(tempFile);
    const floatArray = new Float32Array(buffer.length / 2);
    for (let i = 0; i < floatArray.length; i++) {
      floatArray[i] = buffer.readInt16LE(i * 2) / 32768.0;
    }
    fs.unlinkSync(tempFile); // clean up temp file

    // Perform transcription with progress updates
    ui.updateSpinner("Transcribing audio (0%)...");

    // Set up progress callback
    const progressCallback = (progress: number) => {
      const percent = Math.round(progress * 100);
      ui.updateSpinner(`Transcribing audio (${percent}%)...`);
    };

    // Perform transcription with progress tracking
    const transcriptionResult = await transcriber(floatArray, {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: "en",
      task: "transcribe",
      callback_function: progressCallback,
    });

    return transcriptionResult.text;
  } catch (error) {
    throw error;
  }
}

/**
 * Generate intelligent notes from transcript
 */
async function generateNotes(
  transcript: string,
  options: VideoOptions
): Promise<string> {
  try {
    const formatMap: FormatMap = {
      detailed:
        "Create detailed, comprehensive notes with main topics, subtopics, and key points",
      concise:
        "Create concise, summarized notes highlighting only the most important concepts",
      bullet:
        "Create organized bullet point notes structured in a hierarchical format",
    };

    const detailMap: FormatMap = {
      standard: "Provide a standard level of detail covering the main concepts",
      comprehensive:
        "Provide a comprehensive analysis with extensive details, examples, and connections between concepts",
      exhaustive:
        "Create extremely detailed notes capturing virtually all information from the content, including minor details, nuances, and subtle points",
    };

    const format = formatMap[options.format] || formatMap.detailed;
    const detailLevel =
      detailMap[options.detail || "standard"] || detailMap.standard;
    const languageInstruction =
      options.language !== "english"
        ? `Write the notes in ${options.language}.`
        : "";

    // Handle empty or missing transcript
    if (
      !transcript ||
      transcript.trim().length === 0 ||
      transcript.includes("[This video appears to have no audio content")
    ) {
      // [Existing code for empty transcript handling...]
      return "No content was generated.";
    }

    // Get the selected model configuration
    const modelConfig = getModel(options.model || "claude-3.7-sonnet");

    // For very long transcripts, we need to chunk and process separately
    const MAX_CHUNK_LENGTH = Math.floor(modelConfig.contextWindow * 0.7); // Use 70% of context window for input

    if (transcript.length > MAX_CHUNK_LENGTH) {
      ui.spinnerSuccess(`Transcript is very long (${transcript.length} chars)`);

      // Split transcript into chunks
      const chunks = splitIntoChunks(transcript, MAX_CHUNK_LENGTH);
      ui.startProgressBar(chunks.length, "Processing transcript chunks");

      let allNotes = "";

      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        // Add context about which part this is
        const chunkContext = `PART ${i + 1} OF ${chunks.length}: `;
        const chunkNotes = await processChunk(
          chunkContext + chunks[i],
          modelConfig,
          format,
          detailLevel,
          languageInstruction
        );

        allNotes += chunkNotes + "\n\n";
        ui.updateProgressBar(
          i + 1,
          `Processing chunk ${i + 1}/${chunks.length}`
        );
      }

      ui.stopProgressBar();

      // Now create a final summary if there were multiple chunks
      if (chunks.length > 1) {
        ui.startSpinner("Creating final integrated notes...");

        // Create integration prompt
        const integrationPrompt = `
I have notes from ${chunks.length} different segments of a long video. Please:

1. Review these notes
2. Reorganize them into a cohesive document
3. Remove any redundancies
4. Ensure consistent formatting and structure
5. Maintain the ${options.detail} level of detail
6. Ensure the final notes are ${options.format} in style
7. ${languageInstruction}

Here are the notes to integrate:

${allNotes}`;

        // Process the integration
        const finalNotes = await processWithModel(
          integrationPrompt,
          modelConfig,
          "You are a professional editor who specializes in organizing and integrating complex notes into cohesive documents."
        );

        ui.spinnerSuccess("Final notes created and integrated");
        return finalNotes;
      }

      return allNotes;
    } else {
      // For shorter transcripts, process normally
      const prompt = `
I have a video transcript and I need you to generate intelligent, ${options.detail} notes from it.
${format}. ${detailLevel}. ${languageInstruction}

Focus on identifying key concepts, main points, important details, and organizing them logically.
Do NOT provide a verbatim transcript - instead, extract and synthesize the important information.
Include relevant section headings and organize the content in a clear, structured way.
The notes should be well-formatted with:
- Clear section headings with proper hierarchy (H1, H2, H3, etc.)
- Logical organization of information
- Hierarchical structure when appropriate
- Key terms or concepts emphasized
- In-depth explanations of important concepts
- Connections between related ideas
- ${options.detail === "exhaustive" ? "Include virtually all details and nuances from the content" : ""}

Ensure the notes are thorough and complete, capturing the full breadth and depth of the content.

Here is the transcript:
${transcript}
`;

      return await processWithModel(prompt, modelConfig);
    }
  } catch (error: unknown) {
    throw new Error(`Failed to generate notes: ${(error as Error).message}`);
  }
}

/**
 * Process a single chunk with the appropriate model
 */
async function processChunk(
  chunk: string,
  modelConfig: any,
  format: string,
  detailLevel: string,
  languageInstruction: string
): Promise<string> {
  const prompt = `
I have a segment from a longer video transcript. Please generate ${detailLevel} notes for this segment.
${format}. ${languageInstruction}

Focus on identifying key concepts, main points, important details, and organizing them logically.
Do NOT provide a verbatim transcript - instead, extract and synthesize the important information.
Include relevant section headings and organize the content in a clear, structured way.

The notes should be well-formatted with:
- Clear section headings with proper hierarchy
- Logical organization of information
- Hierarchical structure when appropriate
- Key terms or concepts emphasized

Here is the transcript segment:
${chunk}
`;

  return await processWithModel(prompt, modelConfig);
}

/**
 * Process text with the appropriate model
 */
async function processWithModel(
  prompt: string,
  modelConfig: any,
  systemPrompt: string = "You are a professional note-taker who creates clear, accurate, well-structured notes from video content."
): Promise<string> {
  if (modelConfig.provider === "openai") {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error(
        `OPENAI_API_KEY is required for ${modelConfig.modelName} model`
      );
    }

    const response = await openai.chat.completions.create({
      model: modelConfig.modelName,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.3,
      // Fix: Limit max_tokens to 4096 for OpenAI models
      max_tokens: 4096,
    });

    return response.choices[0].message.content || "";
  } else {
    // Use Anthropic
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        `ANTHROPIC_API_KEY is required for ${modelConfig.modelName} model`
      );
    }

    const response = await anthropic.completions.create({
      model: modelConfig.modelName,
      max_tokens_to_sample: 4096, // Claude also typically has a 4096 token limit for output
      temperature: 0.3,
      prompt: `${Anthropic.HUMAN_PROMPT} ${prompt} ${Anthropic.AI_PROMPT}`,
    });

    return response.completion || "";
  }
}

/**
 * Split text into chunks of approximately equal size
 */
function splitIntoChunks(text: string, maxLength: number): string[] {
  const chunks: string[] = [];

  // Try to split at paragraph boundaries for more natural chunks
  const paragraphs = text.split(/\n\s*\n/);
  let currentChunk = "";

  for (const paragraph of paragraphs) {
    if ((currentChunk + paragraph).length <= maxLength) {
      currentChunk += (currentChunk ? "\n\n" : "") + paragraph;
    } else {
      // If current paragraph would exceed max length
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = paragraph;
      } else {
        // If a single paragraph is too long, split it by sentences
        const sentences = paragraph.match(/[^.!?]+[.!?]+/g) || [paragraph];
        let sentenceChunk = "";

        for (const sentence of sentences) {
          if ((sentenceChunk + sentence).length <= maxLength) {
            sentenceChunk += sentenceChunk ? " " + sentence : sentence;
          } else {
            if (sentenceChunk) {
              chunks.push(sentenceChunk);
              sentenceChunk = sentence;
            } else {
              // If a single sentence is too long, force split it
              chunks.push(sentence.substring(0, maxLength));
              sentenceChunk = sentence.substring(maxLength);
            }
          }
        }

        if (sentenceChunk) {
          currentChunk = sentenceChunk;
        }
      }
    }
  }

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Create a formatted PDF from notes
 */
async function createPDF(
  notes: string,
  options: VideoOptions
): Promise<string> {
  // (Optional:) You can do minimal cleaning here if needed.
  // For production, you may want to store formatting (bullets, headings) as HTML.
  // Here, we assume the AI-generated notes already contain proper newlines.
  const cleanedNotes = notes.trim();
  try {
    const pdfPath = await createPDFfromHTML(cleanedNotes, {
      output: options.output,
    });
    return pdfPath;
  } catch (error: unknown) {
    throw new Error(`Failed to create PDF: ${(error as Error).message}`);
  }
}

// Update the generate command
program
  .command("generate")
  .description("Generate notes from a video file or URL")
  .option("-i, --input <path>", "Path to video file or YouTube URL")
  .option("-o, --output <path>", "Output directory for the PDF")
  .option(
    "-m, --model <model>",
    "AI model to use (claude-3-opus, claude-3.5-sonnet, claude-3.7-sonnet, gpt-4-turbo, gpt-4o)",
    "claude-3.7-sonnet"
  )
  .option("-l, --language <lang>", "Language of the notes", "english")
  .option(
    "-f, --format <format>",
    "Notes format (detailed, concise, bullet)",
    "detailed"
  )
  .option(
    "-d, --detail <level>",
    "Note detail level (standard, comprehensive, exhaustive)",
    "standard"
  )
  .action(async (options) => {
    try {
      displayIntro();

      // Validate or prompt for input
      if (!options.input) {
        const answers = await inquirer.prompt([
          {
            type: "input",
            name: "input",
            message: "Enter video file path or YouTube URL:",
            validate: (input) => {
              if (!input) return "Please provide a video path or URL";
              return true;
            },
          },
        ]);
        options.input = answers.input;
      }

      // Validate or set output directory
      if (!options.output) {
        options.output = path.join(process.cwd(), "notes");
      }

      // Ensure output directory exists
      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }

      // Process the video with our enhanced progress display
      await processVideo(options as VideoOptions);
    } catch (error: unknown) {
      ui.showError("Error", (error as Error).message);
      process.exit(1);
    }
  });

// Update the init command
program
  .command("init")
  .description("Initialize configuration file")
  .action(async () => {
    try {
      displayIntro();

      console.log(
        chalk.blue("Setting up Video Notes Generator configuration...\n")
      );

      // Show available models
      ui.showModelOptions();

      // Check if .env file exists
      const envPath = path.join(process.cwd(), ".env");
      const envExists = fs.existsSync(envPath);

      // Prompt for API keys
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "anthropicKey",
          message: "Enter your Anthropic API key (for Claude models):",
          default: process.env.ANTHROPIC_API_KEY || "",
        },
        {
          type: "input",
          name: "openaiKey",
          message: "Enter your OpenAI API key (for GPT models):",
          default: process.env.OPENAI_API_KEY || "",
        },
      ]);

      // Create or update .env file
      const envContent = `
# Video Notes Generator Configuration
ANTHROPIC_API_KEY=${answers.anthropicKey}
OPENAI_API_KEY=${answers.openaiKey}
      `;

      ui.startSpinner("Saving configuration...");
      fs.writeFileSync(envPath, envContent.trim());
      ui.spinnerSuccess(`Configuration saved to ${envPath}`);

      ui.showInfo(
        "Next Steps",
        'You can now use the "generate" command to create notes from videos.'
      );
      ui.showCommandExample();
    } catch (error: unknown) {
      ui.showError("Error", (error as Error).message);
    }
  });

// Update the check command
program
  .command("check")
  .description("Check if all dependencies are properly installed")
  .action(async () => {
    ui.startSpinner("Checking dependencies...");

    try {
      // Check ffmpeg
      try {
        await new Promise<void>((resolve, reject) => {
          ffmpeg.getAvailableFormats((err, formats) => {
            if (err)
              reject(new Error("FFmpeg not found or not working properly"));
            resolve();
          });
        });
        ui.spinnerSuccess("FFmpeg is installed and working");
      } catch (error: unknown) {
        ui.spinnerFail("FFmpeg is not installed or not working properly");
        console.log(
          chalk.yellow(
            "Please install FFmpeg: https://ffmpeg.org/download.html"
          )
        );
      }

      // Check API keys
      if (process.env.ANTHROPIC_API_KEY) {
        ui.spinnerSuccess("Anthropic API key is configured");
      } else {
        ui.spinnerFail("Anthropic API key is not configured");
        console.log(
          chalk.yellow('Run "video-notes init" to configure API keys')
        );
      }

      if (process.env.OPENAI_API_KEY) {
        ui.spinnerSuccess("OpenAI API key is configured");
      } else {
        ui.spinnerWarning(
          "OpenAI API key is not configured (optional for GPT-4)"
        );
      }

      ui.showSuccess("System Check", "System check completed successfully");
    } catch (error: unknown) {
      ui.showError(
        "Error",
        `Error checking dependencies: ${(error as Error).message}`
      );
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command specified
if (!process.argv.slice(2).length) {
  displayIntro();
  program.outputHelp();
}
