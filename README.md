# VidScript

Transform any video into intelligent, structured notes and scripts with AI.

<p align="center">
  <img src="./vidscript.png" alt="VidScript" width="350" height="auto">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen" alt="Node">
</p>

> **Status:**  
> This project is actively maintained and continuously improving. We welcome contributions and feedback to help shape the future of VidScript.

## 🚀 Features

- **📹 Process Any Video Source** - Works with local files or YouTube URLs
- **🧠 AI-Powered Analysis** - Generate intelligent notes, not just raw transcripts
- **📝 Multiple Formats** - Choose detailed, concise, or bullet-point notes
- **🌍 Language Support** - Generate notes in various languages
- **🤖 Model Selection** - Use Claude or GPT-4 for superior quality
- **📄 Beautiful PDFs** - Get well-formatted PDF output with proper styling
- **⚡ Fast Processing** - Efficient handling of even lengthy videos
- **🔒 Privacy Focused** - All processing happens on your machine

## 📋 Table of Contents

- [Installation](#-installation)
- [Prerequisites](#-prerequisites)
- [Setup](#-setup)
- [Usage](#-usage)
- [Examples](#-examples)
- [How It Works](#-how-it-works)
- [Advanced Configuration](#-advanced-configuration)
- [Troubleshooting](#-troubleshooting)
- [FAQ](#-faq)
- [Contributing](#-contributing)
- [License](#-license)

## 📦 Installation

```bash
# Install globally
npm install -g vidscript

# Or use with npx
npx vidscript
```

## 🔧 Prerequisites

- **Node.js 16+** - The runtime environment for VidScript
- **FFmpeg** - Required for video processing
- **API Keys** - You'll need API keys from:
  - Anthropic Claude (recommended)
  - OpenAI (alternative option)

### Installing FFmpeg

<details>
<summary>MacOS</summary>

```bash
# Using Homebrew
brew install ffmpeg
```

</details>

<details>
<summary>Windows</summary>

```bash
# Using Chocolatey
choco install ffmpeg

# Using Scoop
scoop install ffmpeg
```

</details>

<details>
<summary>Linux</summary>

```bash
# Ubuntu/Debian
sudo apt update && sudo apt install ffmpeg

# CentOS/RHEL
sudo yum install ffmpeg

# Arch Linux
sudo pacman -S ffmpeg
```

</details>

## 🔌 Setup

1. Run the initialization command to set up your configuration:

```bash
vidscript init
```

2. Follow the prompts to provide your API keys and configure default settings.

## 💻 Usage

### Basic Command

```bash
vidscript generate -i <video-source> [options]
```

### Command Options

| Option                  | Description                            | Default    |
| ----------------------- | -------------------------------------- | ---------- |
| `-i, --input <path>`    | Path to video file or YouTube URL      | _Required_ |
| `-o, --output <path>`   | Output directory for the notes         | `./notes`  |
| `-m, --model <model>`   | AI model to use (claude/gpt4)          | `claude`   |
| `-l, --language <lang>` | Language of the notes                  | `english`  |
| `-f, --format <format>` | Notes format (detailed/concise/bullet) | `detailed` |
| `-h, --help`            | Display help information               | -          |

## 📚 Examples

### Generate Notes from YouTube

```bash
vidscript generate -i "https://www.youtube.com/watch?v=EXAMPLE"
```

### Process Local Video with Options

```bash
vidscript generate -i "/path/to/lecture.mp4" -m gpt4 -f concise -l spanish
```

### System Check

Verify your system setup:

```bash
vidscript check
```

## ⚙️ How It Works

1. **Video Processing**

   - Extract audio from the source video
   - For YouTube URLs, the video is downloaded first

2. **Transcription**

   - The audio is processed using a local Whisper model
   - No data is sent to external services during transcription

3. **AI Analysis**

   - The transcript is analyzed by the selected AI model (Claude/GPT-4)
   - Content is organized into structured notes based on your preferences

4. **Output Generation**
   - Notes are formatted into a clean, professional PDF
   - All output is saved to your specified directory

## 🛠️ Advanced Configuration

### Environment Variables

You can set the following environment variables instead of using the init command:

```bash
# API Keys
ANTHROPIC_API_KEY=your_api_key_here
OPENAI_API_KEY=your_api_key_here

# Default Settings
VIDSCRIPT_DEFAULT_MODEL=claude
VIDSCRIPT_DEFAULT_FORMAT=detailed
VIDSCRIPT_DEFAULT_LANGUAGE=english
```

### Custom Templates

VidScript supports custom PDF templates. Place your templates in:

```
~/.vidscript/templates/
```

## ❓ Troubleshooting

### Common Issues

<details>
<summary>YouTube downloads failing</summary>

This is usually due to YouTube changing their API. Try updating VidScript to the latest version:

```bash
npm update -g vidscript
```

</details>

<details>
<summary>FFmpeg errors</summary>

Make sure FFmpeg is installed and available in your PATH. Run:

```bash
ffmpeg -version
```

If not found, follow the installation instructions in the Prerequisites section.

</details>

<details>
<summary>API key issues</summary>

Re-run the initialization:

```bash
vidscript init
```

Or manually check your keys in `~/.vidscript/config.json`

</details>

## 📝 FAQ

<details>
<summary>How much do the API calls cost?</summary>

Costs vary depending on the length of video and model used. As a rough estimate:

- 10-minute video: ~$0.05-0.15 with Claude, ~$0.10-0.30 with GPT-4
- 1-hour video: ~$0.30-0.90 with Claude, ~$0.60-1.80 with GPT-4
</details>

<details>
<summary>Can I use this for commercial purposes?</summary>

Yes! VidScript is licensed under MIT. However, be aware of the terms of service for the AI providers (Anthropic & OpenAI) when using their APIs.

</details>

<details>
<summary>How does VidScript handle long videos?</summary>

VidScript processes videos in chunks, making it capable of handling videos of any length. For very long videos (2+ hours), the process may take some time and use more API tokens.

</details>

## 👥 Contributing

Contributions are welcome! Here's how you can help:

1. **Report bugs** by opening an issue
2. **Suggest features** that would make VidScript more valuable
3. **Submit pull requests** to help implement fixes or features

Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting pull requests.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Made with ❤️ by the VidScript team
</p>

<p align="center">
  <a href="https://github.com/yourusername/vidscript">GitHub</a> •
  <a href="https://github.com/yourusername/vidscript/issues">Report Bug</a> •
  <a href="https://github.com/yourusername/vidscript/issues">Request Feature</a>
</p>
