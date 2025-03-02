#!/usr/bin/env node

import { Command } from "commander";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import ora, { Ora } from "ora";
import inquirer from "inquirer";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname } from "path";
import ffmpeg from "fluent-ffmpeg";
import ytdl from "ytdl-core";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { Anthropic } from "@anthropic-ai/sdk";
import { OpenAI } from "openai";
import * as whisper from "@xenova/transformers";
import boxen from "boxen";
import gradient from "gradient-string";
import updateNotifier from "update-notifier";
// Update import assertion to use "with" instead of "assert"
import pkg from "../package.json" with { type: "json" };
import { VideoOptions, FormatMap } from "./types.js";
import { exec } from "child_process";
import { createPDFfromHTML } from "./createPDFHtml.js";

// Environment setup
dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// ASCII Art and CLI styling
const displayIntro = (): void => {
  console.log(
    gradient.pastel.multiline(
      `
 __      ___     _               _   _       _            
 \\ \\    / (_)   | |             | \\ | |     | |           
  \\ \\  / / _  __| | ___  ___    |  \\| | ___ | |_ ___  ___ 
   \\ \\/ / | |/ _\` |/ _ \\/ _ \\   | . \` |/ _ \\| __/ _ \\/ __|
    \\  /  | | (_| |  __/ (_) |  | |\\  | (_) | ||  __/\\__ \\
     \\/   |_|\\__,_|\\___|\\___/   |_| \\_|\\___/ \\__\\___||___/
                                                          
                                                          
      `
    )
  );

  console.log(
    boxen(
      `${chalk.bold("Video Notes Generator")} ${chalk.dim("v" + pkg.version)}\n` +
        `${chalk.blue("Generate intelligent notes from any video.")}`,
      {
        padding: 1,
        margin: 1,
        borderStyle: "round",
        borderColor: "cyan",
      }
    )
  );
};

// Program setup
program
  .name("video-notes")
  .description("Generate intelligent notes from video content")
  .version(pkg.version);

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

      // Process the video
      await processVideo(options as VideoOptions);
    } catch (error: unknown) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      process.exit(1);
    }
  });

/**
 * Process video file or URL and generate notes
 */
async function processVideo(options: VideoOptions): Promise<string> {
  const spinner = ora("Analyzing video source...").start();

  try {
    const isYouTubeUrl =
      options.input.includes("youtube.com") ||
      options.input.includes("youtu.be");

    let videoPath: string;

    if (isYouTubeUrl) {
      // Try ytdl-core first, then fall back to youtube-dl if available
      try {
        videoPath = await downloadYouTubeVideo(options.input, spinner);
      } catch (ytdlError) {
        spinner.warn(`ytdl-core failed: ${(ytdlError as Error).message}`);
        spinner.text = "Trying alternative download method...";

        try {
          videoPath = await downloadWithYoutubeDl(options.input, spinner);
        } catch (ytError) {
          throw new Error(
            `Could not download YouTube video: ${(ytError as Error).message}`
          );
        }
      }
    } else {
      videoPath = options.input;
    }

    // Extract audio from video
    spinner.text = "Extracting audio...";
    const audioPath = await extractAudioFromVideo(videoPath);

    // Transcribe audio
    spinner.text = "Transcribing audio...";
    const transcript = await transcribeAudio(audioPath);

    // Generate intelligent notes
    spinner.text = "Generating intelligent notes...";
    const notes = await generateNotes(transcript, options);

    // Create PDF
    spinner.text = "Creating PDF document...";
    const pdfPath = await createPDF(notes, options);

    // Clean up temporary files
    if (isYouTubeUrl) {
      try {
        fs.unlinkSync(videoPath);
      } catch (err) {
        console.warn("Could not clean up video file");
      }
    }
    try {
      fs.unlinkSync(audioPath);
    } catch (err) {
      console.warn("Could not clean up audio file");
    }

    spinner.succeed(`Notes generated successfully at ${chalk.green(pdfPath)}`);

    return pdfPath;
  } catch (error: unknown) {
    spinner.fail("Failed to process video");
    throw error;
  }
}

/**
 * Download YouTube video with enhanced reliability
 */
async function downloadYouTubeVideo(
  url: string,
  spinner: Ora
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      spinner.text = "Preparing to download YouTube video...";

      // Create temp file path
      const tempDir = process.env.TEMP || "/tmp";
      const videoPath = path.join(tempDir, `video_${Date.now()}.mp4`);

      // Try to get video info first to validate URL
      ytdl
        .getInfo(url)
        .then((info) => {
          spinner.text = `Downloading video: ${info.videoDetails.title}`;

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
              reject(new Error("No suitable video format found"));
              return;
            }

            // Create stream from format
            ytdl
              .downloadFromInfo(info, { format: fallbackFormat })
              .pipe(fs.createWriteStream(videoPath))
              .on("finish", () => resolve(videoPath))
              .on("error", (err) =>
                reject(new Error(`Download failed: ${err.message}`))
              );
          } else {
            // Use the best format found
            ytdl
              .downloadFromInfo(info, { format: format })
              .pipe(fs.createWriteStream(videoPath))
              .on("finish", () => {
                // Verify file exists and has content
                if (
                  fs.existsSync(videoPath) &&
                  fs.statSync(videoPath).size > 0
                ) {
                  resolve(videoPath);
                } else {
                  reject(new Error("Downloaded file is empty or missing"));
                }
              })
              .on("error", (err) =>
                reject(new Error(`Download failed: ${err.message}`))
              );
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
 * Alternative YouTube download using yt-dlp (if available)
 */
async function downloadWithYoutubeDl(
  url: string,
  spinner: Ora
): Promise<string> {
  return new Promise((resolve, reject) => {
    const tempDir = process.env.TEMP || "/tmp";
    const outputPath = path.join(tempDir, `video_${Date.now()}.mp4`);

    spinner.text = "Downloading with yt-dlp...";

    exec(
      `yt-dlp -f "best[height<=480]" -o "${outputPath}" "${url}"`,
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`yt-dlp failed: ${error.message}`));
          return;
        }

        if (fs.existsSync(outputPath) && fs.statSync(outputPath).size > 0) {
          resolve(outputPath);
        } else {
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
    const audioPath = videoPath.replace(/\.[^/.]+$/, "") + ".mp3";

    ffmpeg(videoPath)
      .outputOptions("-ab", "128k")
      .output(audioPath)
      .on("end", () => resolve(audioPath))
      .on("error", (err) =>
        reject(new Error(`Failed to extract audio: ${err.message}`))
      )
      .run();
  });
}

/**
 * Transcribe audio using Whisper
 */
async function transcribeAudio(audioPath: string): Promise<string> {
  try {
    // Import the audio utilities from transformers
    const { pipeline, env } = whisper as any;

    // Set pipeline parameters to avoid browser-only features
    env.allowLocalModels = true;
    env.backends.onnx.wasm.numThreads = 1;

    // Initialize the pipeline with the proper model
    const transcriber = await pipeline(
      "automatic-speech-recognition",
      "Xenova/whisper-tiny.en"
    );

    // Create a function to process audio to correct format
    const processAudioFile = async (
      filePath: string
    ): Promise<Float32Array> => {
      return new Promise((resolve, reject) => {
        try {
          // Use ffmpeg to convert audio to raw PCM data
          const tempFile = filePath + ".pcm";
          ffmpeg(filePath)
            .outputOptions([
              "-f",
              "s16le", // Output as signed 16-bit little-endian
              "-acodec",
              "pcm_s16le", // PCM codec
              "-ar",
              "16000", // Sample rate: 16kHz
              "-ac",
              "1", // Mono channel
            ])
            .output(tempFile)
            .on("end", () => {
              try {
                // Read the raw PCM data
                const buffer = fs.readFileSync(tempFile);

                // Convert PCM buffer to Float32Array (normalize 16-bit values to -1.0 to 1.0)
                const floatArray = new Float32Array(buffer.length / 2);
                for (let i = 0; i < floatArray.length; i++) {
                  // Convert 16-bit PCM to float (-32768 to 32767 → -1.0 to 1.0)
                  floatArray[i] = buffer.readInt16LE(i * 2) / 32768.0;
                }

                // Clean up temp file
                fs.unlinkSync(tempFile);

                resolve(floatArray);
              } catch (err) {
                reject(
                  new Error(
                    `Failed to process audio data: ${(err as Error).message}`
                  )
                );
              }
            })
            .on("error", (err) => {
              reject(new Error(`FFmpeg conversion failed: ${err.message}`));
            })
            .run();
        } catch (err) {
          reject(
            new Error(`Audio processing failed: ${(err as Error).message}`)
          );
        }
      });
    };

    // Process the audio to get Float32Array data
    const audioData = await processAudioFile(audioPath);

    // Transcribe with proper parameters
    const transcriptionResult = await transcriber(audioData, {
      chunk_length_s: 30,
      stride_length_s: 5,
      language: "en",
      task: "transcribe",
      return_timestamps: false,
    });

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
