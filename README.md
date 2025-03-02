# VideoNotes AI

An AI-powered CLI tool that transforms video content into intelligent, structured notes.

![VideoNotes AI](https://via.placeholder.com/800x200/0073e6/ffffff?text=VideoNotes+AI)

> **Status:**  
> This project is in its early stages and is actively maintained. Please note that you may encounter bugs as new features are added and improvements are made. Contributions and feedback are highly encouraged to help shape the future of this project.

## Features

- **Process Any Video Source** - Local video files or YouTube URLs
- **AI-Powered Notes** - Generate intelligent notes, not just raw transcripts
- **Multiple Formats** - Choose between detailed, concise, or bullet-point notes
- **Language Support** - Generate notes in various languages
- **Model Selection** - Use either Claude or GPT-4 for note generation
- **Beautiful PDFs** - Get well-formatted PDF output with proper styling and structure

## Installation

```bash
# Install globally
npm install -g video-notes-generator

# Or use with npx
npx video-notes-generator
```

## Prerequisites

- Node.js 16 or higher
- FFmpeg installed on your system
- API keys for Anthropic and/or OpenAI (depending on your preference)

## Setup

1. Run the initialization command to set up your configuration:

```bash
video-notes init
```

2. Follow the prompts to provide your API keys.

## Usage

### Basic Usage

Generate notes from a YouTube video:

```bash
video-notes generate -i "https://www.youtube.com/watch?v=EXAMPLE" -o ./my-notes
```

Generate notes from a local video file:

```bash
video-notes generate -i "/path/to/your/video.mp4"
```

### Command Options

```
Options:
  -i, --input <path>       Path to video file or YouTube URL
  -o, --output <path>      Output directory for the PDF (default: ./notes)
  -m, --model <model>      AI model to use (claude or gpt4) (default: "claude")
  -l, --language <lang>    Language of the notes (default: "english")
  -f, --format <format>    Notes format (detailed, concise, bullet) (default: "detailed")
  -h, --help               Display help information
```

### Examples

Generate concise notes using GPT-4:

```bash
video-notes generate -i "https://youtu.be/EXAMPLE" -m gpt4 -f concise
```

Generate notes in Spanish with bullet points:

```bash
video-notes generate -i "./lecture.mp4" -l spanish -f bullet
```

## System Check

Verify your system setup:

```bash
video-notes check
```

## How It Works

1. **Video Processing**: Extract the audio from the input video
2. **Transcription**: Convert the speech to text using Whisper
3. **AI Analysis**: Process the transcript to generate intelligent notes
4. **PDF Creation**: Format the notes into a clean, structured PDF document

## Contributing

Contributions are welcome and highly appreciated. Since this project is still early in its development, you may encounter issues or incomplete features. Please submit any bugs, feature requests, or pull requests to help improve the project and drive innovation.

## License

This project is licensed under the MIT License - see the LICENSE file for details.