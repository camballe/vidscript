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
import { Anthropic } from "@anthropic-ai/sdk";
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

// Environment setup
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Completely suppress ALL ONNX warnings by redirecting stderr
// This is more aggressive than what we had before
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
const originalStderrWrite = process.stderr.write.bind(process.stderr);

process.stderr.write = ((data: string | Uint8Array) => {
  // Check if this is an ONNX warning
  const strData = String(data);
  if (
    strData.includes("onnxruntime") ||
    strData.includes("Removing initializer") ||
    /\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}:\d{2}\.\d{3}\snode\[\d+:\d+\]/.test(strData)
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

// Enhanced ASCII Art and CLI styling
const displayIntro = (): void => {
  console.clear();

  // Create a stunning gradient effect
  const rainbowTitle = gradient([
    "#FF5733",
    "#C70039",
    "#900C3F",
    "#581845",
    "#2E86C1",
    "#17A589",
  ]).multiline(`
 __      ___     _               _   _       _            
 \\ \\    / (_)   | |             | \\ | |     | |           
  \\ \\  / / _  __| | ___  ___    |  \\| | ___ | |_ ___  ___ 
   \\ \\/ / | |/ _\` |/ _ \\/ _ \\   | . \` |/ _ \\| __/ _ \\/ __|
    \\  /  | | (_| |  __/ (_) |  | |\\  | (_) | ||  __/\\__ \\
     \\/   |_|\\__,_|\\___|\\___/   |_| \\_|\\___/ \\__\\___||___/
                                                                                                  
    `);

  console.log(rainbowTitle);

  // Create a beautiful boxed info display
  console.log(
    boxen(
      `${chalk.bold.cyan("Video Notes Generator")} ${chalk.dim("v" + pkg.version)}\n\n` +
        `${chalk.blue(figures.pointer)} ${chalk.white("Generate intelligent notes from any video")}`,
      {
        padding: 1,
        margin: { top: 0, right: 1, bottom: 1, left: 1 },
        borderStyle: "round",
        borderColor: "cyan",
        float: "center",
        title: "✨ Welcome ✨",
        titleAlignment: "center",
      }
    )
  );
};

/**
 * Process video file or URL and generate notes
 */
async function processVideo(options: VideoOptions): Promise<string> {
  try {
    // Step 1: Analyze video
    const analyzeSpinner = ora({
      text: chalk.blue("Analyzing video source..."),
      spinner: "dots",
    }).start();

    const isYouTubeUrl =
      options.input.includes("youtube.com") ||
      options.input.includes("youtu.be");

    let videoPath: string;

    if (isYouTubeUrl) {
      // Try ytdl-core first, then fall back to youtube-dl if available
      try {
        analyzeSpinner.text = chalk.blue("Downloading YouTube video...");
        videoPath = await downloadYouTubeVideo(options.input);
      } catch (ytdlError) {
        analyzeSpinner.text = chalk.blue(
          "Trying alternative download method..."
        );

        try {
          videoPath = await downloadWithYoutubeDl(options.input);
        } catch (ytError) {
          analyzeSpinner.fail(
            chalk.red(
              `Could not download YouTube video: ${(ytError as Error).message}`
            )
          );
          throw new Error(
            `Could not download YouTube video: ${(ytError as Error).message}`
          );
        }
      }
    } else {
      videoPath = options.input;
    }

    analyzeSpinner.succeed(chalk.green("Video analyzed successfully"));

    // Step 2: Extract audio from video
    const extractSpinner = ora({
      text: chalk.blue("Extracting audio from video..."),
      spinner: "dots",
    }).start();

    let audioPath;
    let transcript = "";

    try {
      audioPath = await extractAudioFromVideo(videoPath);
      extractSpinner.succeed(chalk.green("Audio extracted successfully"));

      // Step 3: Transcribe audio
      const transcribeSpinner = ora({
        text: chalk.blue("Transcribing audio content..."),
        spinner: "dots",
      }).start();

      transcript = await transcribeAudio(audioPath);
      transcribeSpinner.succeed(chalk.green("Transcription completed"));
    } catch (audioError) {
      extractSpinner.warn(
        chalk.yellow(`Audio extraction issue: ${(audioError as Error).message}`)
      );
      extractSpinner.text = chalk.blue("Proceeding with empty transcript...");
      transcript =
        "[This video appears to have no audio content to transcribe]";
      extractSpinner.succeed(chalk.green("Proceeding without audio"));
    }

    // Step 4: Generate intelligent notes
    const notesSpinner = ora({
      text: chalk.blue("Creating intelligent notes from content..."),
      spinner: "dots",
    }).start();

    const notes = await generateNotes(transcript, options);
    notesSpinner.succeed(chalk.green("Notes generated successfully"));

    // Step 5: Create PDF
    const pdfSpinner = ora({
      text: chalk.blue("Creating beautiful PDF document..."),
      spinner: "dots",
    }).start();

    const pdfPath = await createPDF(notes, options);
    pdfSpinner.succeed(chalk.green("PDF created successfully"));

    // Clean up temporary files
    if (isYouTubeUrl) {
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
    const pdfPathDisplay = terminalLink("Open PDF", `file://${pdfPath}`, {
      fallback: (text) => text,
    });

    console.log(
      "\n" +
        boxen(
          `${chalk.green(figures.tick)} Notes generated successfully!\n\n` +
            `${chalk.white("PDF saved to:")} ${chalk.cyan(pdfPath)}\n\n` +
            `${pdfPathDisplay}`,
          {
            padding: 1,
            margin: { top: 0, bottom: 0 },
            borderStyle: "round",
            borderColor: "green",
            title: "Success",
            titleAlignment: "center",
          }
        )
    );

    return pdfPath;
  } catch (error: unknown) {
    console.error(
      boxen(chalk.red(`${figures.cross} ${(error as Error).message}`), {
        padding: 1,
        margin: { top: 0, bottom: 0 },
        borderStyle: "round",
        borderColor: "red",
        title: "Error",
        titleAlignment: "center",
      })
    );
    throw error;
  }
}

/**
 * Download YouTube video
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
          const downloadSpinner = ora({
            text: chalk.blue(
              `Downloading: ${videoTitle.substring(0, 40)}${videoTitle.length > 40 ? "..." : ""}`
            ),
            spinner: "dots",
          }).start();

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
              downloadSpinner.fail(chalk.red("No suitable video format found"));
              reject(new Error("No suitable video format found"));
              return;
            }

            // Create stream from format
            const stream = ytdl.downloadFromInfo(info, {
              format: fallbackFormat,
            });

            stream
              .pipe(fs.createWriteStream(videoPath))
              .on("finish", () => {
                downloadSpinner.succeed(chalk.green("Download complete"));
                resolve(videoPath);
              })
              .on("error", (err) => {
                downloadSpinner.fail(
                  chalk.red(`Download failed: ${err.message}`)
                );
                reject(new Error(`Download failed: ${err.message}`));
              });
          } else {
            // Use the best format found
            const stream = ytdl.downloadFromInfo(info, { format: format });

            stream
              .pipe(fs.createWriteStream(videoPath))
              .on("finish", () => {
                // Verify file exists and has content
                if (
                  fs.existsSync(videoPath) &&
                  fs.statSync(videoPath).size > 0
                ) {
                  downloadSpinner.succeed(chalk.green("Download complete"));
                  resolve(videoPath);
                } else {
                  downloadSpinner.fail(
                    chalk.red("Downloaded file is empty or missing")
                  );
                  reject(new Error("Downloaded file is empty or missing"));
                }
              })
              .on("error", (err) => {
                downloadSpinner.fail(
                  chalk.red(`Download failed: ${err.message}`)
                );
                reject(new Error(`Download failed: ${err.message}`));
              });
          }
        })
        .catch((err) => {
          reject(new Error(`Failed to fetch video info: ${err.message}`));
        });
    } catch (error: unknown) {
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
 * Transcribe audio using Whisper
 */
async function transcribeAudio(audioPath: string): Promise<string> {
  try {
    // Completely silence warnings during this process
    const originalWarn = console.warn;
    const originalError = console.error;
    console.warn = function () {};
    console.error = function () {};

    // Initialize the pipeline with the proper model
    const { pipeline, env } = whisper as any;

    // Set pipeline parameters to avoid browser-only features
    env.allowLocalModels = true;
    env.backends.onnx.wasm.numThreads = 1;

    const loadingSpinner = ora({
      text: chalk.blue("Loading speech recognition model..."),
      spinner: "dots",
    }).start();

    const transcriber = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny.en"
    );

    loadingSpinner.succeed(chalk.green("Speech recognition model loaded"));

    // Process audio file
    const processingSpinner = ora({
      text: chalk.blue("Processing audio format..."),
      spinner: "dots",
    }).start();

    // Convert audio file to raw PCM data
    const tempFile = audioPath + ".pcm";

    await new Promise<void>((resolve, reject) => {
      ffmpeg(audioPath)
        .outputOptions([
          "-f",
          "s16le",
          "-acodec",
          "pcm_s16le",
          "-ar",
          "16000",
          "-ac",
          "1",
        ])
        .output(tempFile)
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    // Read the raw PCM data
    const buffer = fs.readFileSync(tempFile);

    // Convert PCM buffer to Float32Array
    const floatArray = new Float32Array(buffer.length / 2);
    for (let i = 0; i < floatArray.length; i++) {
      floatArray[i] = buffer.readInt16LE(i * 2) / 32768.0;
    }

    // Clean up temp file
    fs.unlinkSync(tempFile);
    processingSpinner.succeed(chalk.green("Audio processing complete"));

    // Show an elegant spinner for transcription process
    const transcribeSpinner = ora({
      text: chalk.blue("Running speech recognition..."),
      spinner: "dots",
    }).start();

    // Transcribe with proper parameters
    const transcriptionResult = await transcriber(floatArray, {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: "en",
      task: "transcribe",
    });

    // Restore console functions
    console.warn = originalWarn;
    console.error = originalError;

    transcribeSpinner.succeed(chalk.green("Transcription complete"));
    return transcriptionResult.text;
  } catch (error: unknown) {
    throw new Error(`Transcription failed: ${(error as Error).message}`);
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

    const format = formatMap[options.format] || formatMap.detailed;
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
      const prompt = `
I need you to generate notes for a video that appears to have no audio content.
Please create ${options.format} notes that explain:
1. This video doesn't have audio content to transcribe
2. Suggest to the user that they may want to check if the video actually has audio
3. Remind them that they can also try providing a different video source
      `;

      // Use the model to generate a helpful response
      if (options.model === "gpt4") {
        if (!process.env.OPENAI_API_KEY) {
          throw new Error("OPENAI_API_KEY is required for GPT-4 model");
        }

        const response = await openai.chat.completions.create({
          model: "gpt-4-turbo",
          messages: [
            {
              role: "system",
              content:
                "You are a professional note-taker who creates clear, accurate, well-structured notes from video content.",
            },
            { role: "user", content: prompt },
          ],
          temperature: 0.3,
          max_tokens: 4000,
        });

        return response.choices[0].message.content || "";
      } else {
        // Use Claude by default
        if (!process.env.ANTHROPIC_API_KEY) {
          throw new Error("ANTHROPIC_API_KEY is required for Claude model");
        }

        const response = await anthropic.completions.create({
          model: "claude-3-opus-20240229",
          max_tokens_to_sample: 4000,
          temperature: 0.3,
          prompt: `
System: You are a professional note-taker who creates clear, accurate, well-structured notes from video content.
Human: ${prompt}
Assistant:`,
        });

        // Access the completion from the response
        if (response.completion && response.completion.trim().length > 0) {
          return response.completion;
        }

        return "No content was generated.";
      }
    }

    // Normal notes generation
    const prompt = `
I have a video transcript and I need you to generate intelligent notes from it.
${format}. ${languageInstruction}

Focus on identifying key concepts, main points, important details, and organizing them logically.
Do NOT provide a verbatim transcript - instead, extract and synthesize the important information.
Include relevant section headings and organize the content in a clear, structured way.

The notes should be well-formatted with:
- Clear section headings
- Logical organization of information
- Hierarchical structure when appropriate
- Key terms or concepts emphasized

Here is the transcript:
${transcript}
    `;

    // Use specified model to generate notes
    if (options.model === "gpt4") {
      if (!process.env.OPENAI_API_KEY) {
        throw new Error("OPENAI_API_KEY is required for GPT-4 model");
      }

      const response = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: [
          {
            role: "system",
            content:
              "You are a professional note-taker who creates clear, accurate, well-structured notes from video content.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      });

      return response.choices[0].message.content || "";
    } else {
      // Use Claude by default
      if (!process.env.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY is required for Claude model");
      }

      const response = await anthropic.completions.create({
        model: "claude-3-opus-20240229",
        max_tokens_to_sample: 4000,
        temperature: 0.3,
        prompt: `
System: You are a professional note-taker who creates clear, accurate, well-structured notes from video content.
Human: ${prompt}
Assistant:`,
      });

      // Access the completion from the response
      if (response.completion && response.completion.trim().length > 0) {
        return response.completion;
      }

      return "No content was generated.";
    }
  } catch (error: unknown) {
    throw new Error(`Failed to generate notes: ${(error as Error).message}`);
  }
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

// Command to generate notes from a video
program
  .command("generate")
  .description("Generate notes from a video file or URL")
  .option("-i, --input <path>", "Path to video file or YouTube URL")
  .option("-o, --output <path>", "Output directory for the PDF")
  .option("-m, --model <model>", "AI model to use (claude or gpt4)", "claude")
  .option("-l, --language <lang>", "Language of the notes", "english")
  .option(
    "-f, --format <format>",
    "Notes format (detailed, concise, bullet)",
    "detailed"
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
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

// Command to initialize configuration
program
  .command("init")
  .description("Initialize configuration file")
  .action(async () => {
    try {
      console.log(
        chalk.blue("Setting up Video Notes Generator configuration...\n")
      );

      // Check if .env file exists
      const envPath = path.join(process.cwd(), ".env");
      const envExists = fs.existsSync(envPath);

      // Prompt for API keys
      const answers = await inquirer.prompt([
        {
          type: "input",
          name: "anthropicKey",
          message: "Enter your Anthropic API key (for Claude):",
          default: process.env.ANTHROPIC_API_KEY || "",
        },
        {
          type: "input",
          name: "openaiKey",
          message: "Enter your OpenAI API key (for GPT-4):",
          default: process.env.OPENAI_API_KEY || "",
        },
      ]);

      // Create or update .env file
      const envContent = `
# Video Notes Generator Configuration
ANTHROPIC_API_KEY=${answers.anthropicKey}
OPENAI_API_KEY=${answers.openaiKey}
      `;

      fs.writeFileSync(envPath, envContent.trim());

      console.log(chalk.green(`\n✓ Configuration saved to ${envPath}`));
      console.log(
        chalk.blue(
          'You can now use the "generate" command to create notes from videos.'
        )
      );
    } catch (error: unknown) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
    }
  });

// Health check command
program
  .command("check")
  .description("Check if all dependencies are properly installed")
  .action(async () => {
    const spinner = ora("Checking dependencies...").start();

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
        spinner.succeed("FFmpeg is installed and working");
      } catch (error: unknown) {
        spinner.fail("FFmpeg is not installed or not working properly");
        console.log(
          chalk.yellow(
            "Please install FFmpeg: https://ffmpeg.org/download.html"
          )
        );
      }

      // Check API keys
      if (process.env.ANTHROPIC_API_KEY) {
        spinner.succeed("Anthropic API key is configured");
      } else {
        spinner.fail("Anthropic API key is not configured");
        console.log(
          chalk.yellow('Run "video-notes init" to configure API keys')
        );
      }

      if (process.env.OPENAI_API_KEY) {
        spinner.succeed("OpenAI API key is configured");
      } else {
        spinner.warn("OpenAI API key is not configured (optional for GPT-4)");
      }

      console.log(chalk.green("\n✓ System check completed"));
    } catch (error: unknown) {
      spinner.fail(`Error checking dependencies: ${(error as Error).message}`);
    }
  });

// Parse command line arguments
program.parse(process.argv);

// Show help if no command specified
if (!process.argv.slice(2).length) {
  displayIntro();
  program.outputHelp();
}
