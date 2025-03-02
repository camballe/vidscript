# VidScript

AI-powered CLI tool that transforms video content into intelligent, structured notes.

## Overview

VidScript is a command line tool that processes video files or YouTube videos and generates well-structured notes using AI. It extracts audio, transcribes speech, and uses AI models to organize content into coherent notes.

## Installation

```bash
# Install globally
npm install -g vidscript

# Or use with npx
npx vidscript
```

## Prerequisites

- Node.js 16 or higher
- FFmpeg installed on your system
- API keys for Anthropic and/or OpenAI

## Setup

1. Run the initialization command to set up your configuration:

```bash
vidscript init
```

2. Follow the prompts to provide your API keys.

## Usage

### Basic Commands

```bash
# Generate notes from a YouTube video
vidscript generate -i "https://www.youtube.com/watch?v=EXAMPLE" -o ./my-notes

# Generate notes from a local video file
vidscript generate -i "/path/to/your/video.mp4"
```

### Command Options

| Option                  | Description                              | Default    |
| ----------------------- | ---------------------------------------- | ---------- |
| `-i, --input <path>`    | Path to video file or YouTube URL        | _Required_ |
| `-o, --output <path>`   | Output directory for the PDF             | `./notes`  |
| `-m, --model <model>`   | AI model to use (claude or gpt4)         | `claude`   |
| `-l, --language <lang>` | Language of the notes                    | `english`  |
| `-f, --format <format>` | Notes format (detailed, concise, bullet) | `detailed` |
| `-h, --help`            | Display help information                 | -          |

### Examples

Generate concise notes using GPT-4:

```bash
vidscript generate -i "https://youtu.be/EXAMPLE" -m gpt4 -f concise
```

Generate notes in Spanish with bullet points:

```bash
vidscript generate -i "./lecture.mp4" -l spanish -f bullet
```

### System Check

Verify your system setup:

```bash
vidscript check
```

## How It Works

1. **Video Processing**: Extract audio from the input video (or download YouTube video first)
2. **Transcription**: Convert speech to text using Whisper
3. **AI Analysis**: Process the transcript to generate structured notes
4. **PDF Creation**: Format the notes into a clean, structured PDF document

## Contributing

Contributions are welcome. Please feel free to submit issues or pull requests to help improve the project.

## License

This project is licensed under the MIT License.
