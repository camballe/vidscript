# VidScript

AI-powered CLI tool that transforms video content into intelligent, structured notes and scripts.

## Overview

VidScript is a powerful command line tool that processes video files or YouTube videos and generates well-structured notes using AI. It extracts audio, transcribes speech, and leverages advanced AI models to organize content into coherent notes and scripts. Built with TypeScript and modern AI technologies, it offers a seamless experience for content creators, students, and professionals.

## Features

- 🎥 Support for both local video files and YouTube URLs
- 🤖 Multiple AI model options (Anthropic's Claude, OpenAI's GPT-4)
- 🌐 Multi-language support for transcription and notes
- 📝 Multiple output formats (detailed, concise, bullet points)
- 📊 Vector database integration for enhanced content analysis
- 🎨 Beautiful PDF output with customizable formatting
- ⚡ Fast processing with modern async operations
- 🔄 Progress tracking and status updates
- 🛠️ System compatibility checking

## Prerequisites

- Node.js 16 or higher
- FFmpeg installed on your system
- API keys for:
  - Anthropic (Claude)
  - OpenAI (optional, for GPT-4)
  - Pinecone (for vector storage)

## Installation

```bash
# Install globally using npm
npm install -g vidscript

# Or use with npx
npx vidscript

# Or install using Bun
bun install -g vidscript
```

## Setup

1. Run the initialization command:
```bash
vidscript init
```

2. Follow the prompts to configure:
   - AI model preferences
   - API keys
   - Default output settings
   - Vector database settings

## Usage

### Basic Commands

```bash
# Process a YouTube video
vidscript generate -i "https://www.youtube.com/watch?v=EXAMPLE" -o ./my-notes

# Process a local video file
vidscript generate -i "/path/to/video.mp4"

# Generate a script with specific settings
vidscript generate -i "video_source" -m claude -f script -l english
```

### Command Options

| Option                           | Description                                | Default    |
|--------------------------------|--------------------------------------------|------------|
| `-i, --input <path>`            | Video file path or YouTube URL             | _Required_ |
| `-o, --output <path>`           | Output directory for generated files       | `./notes`  |
| `-m, --model <model>`           | AI model (claude-3-opus, claude-3.5-sonnet, claude-3.7-sonnet, gpt-4-turbo, gpt-4)| `claude-3.7-sonnet` |
| `-l, --language <lang>`         | Output language                            | `english`  |
| `-f, --format <format>`         | Output format (detailed/concise/bullet)    | `detailed` |
| `-d, --detail <level>`          | Note detail level (standard/comprehensive/exhaustive)| `standard` |
| `--vector-store`                | Enable vector store for long transcripts   | `false`    |
| `--vector-store-index <name>`   | Vector store index name                    | `vidscript`|
| `--vector-store-namespace <ns>` | Vector store namespace                     | `default`  |
| `-h, --help`                    | Display help information                   | -          |

### Advanced Features

1. **Vector Analysis**: Enable deep content analysis for long videos
```bash
vidscript generate -i "video.mp4" --vector-store --vector-store-index custom-index
```

2. **Custom Formatting**: Generate specialized formats
```bash
vidscript generate -i "source" -f script --template custom
```

3. **Batch Processing**: Handle multiple videos
```bash
vidscript batch -d "./videos" -o "./notes"
```

## Project Structure

```
vidscript/
├── src/
│   ├── index.ts         # Main application logic
│   ├── models.ts        # AI model integrations
│   ├── types.ts         # TypeScript type definitions
│   ├── ui.ts           # CLI interface components
│   ├── vectorStore.ts   # Vector database operations
│   └── createPDFHtml.ts # PDF generation logic
├── dist/               # Compiled JavaScript output
└── public/            # Static assets
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build the project
npm run build

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Enoch Kambale

## Support

For issues and feature requests, please use the [GitHub issues page](https://github.com/camballe/vidscript/issues).
