import chalk from "chalk";
import ora, { Ora } from "ora";
import boxen from "boxen";
import gradient from "gradient-string";
import figures from "figures";
import terminalLink from "terminal-link";
import logUpdate from "log-update";
import cliProgress from "cli-progress";

export class UIManager {
  private static instance: UIManager;
  private currentSpinner: Ora | null = null;
  private progressBar: cliProgress.SingleBar | null = null;
  private isProgressBarActive = false;

  // Beautiful gradients
  private gradients = {
    primary: gradient(["#FF6B6B", "#556270"]),
    success: gradient(["#00F260", "#0575E6"]),
    info: gradient(["#3494E6", "#EC6EAD"]),
    warning: gradient(["#F09819", "#EDDE5D"]),
    error: gradient(["#CB356B", "#BD3F32"]),
  };

  private constructor() {}

  public static getInstance(): UIManager {
    if (!UIManager.instance) {
      UIManager.instance = new UIManager();
    }
    return UIManager.instance;
  }

  public clearScreen(): void {
    console.clear();
  }

  public displayLogo(): void {
    const logo = this.gradients.primary.multiline(`
 __      ___     _               _   _       _            
 \\ \\    / (_)   | |             | \\ | |     | |           
  \\ \\  / / _  __| | ___  ___    |  \\| | ___ | |_ ___  ___ 
   \\ \\/ / | |/ _\` |/ _ \\/ _ \\   | . \` |/ _ \\| __/ _ \\/ __|
    \\  /  | | (_| |  __/ (_) |  | |\\  | (_) | ||  __/\\__ \\
     \\/   |_|\\__,_|\\___|\\___/   |_| \\_|\\___/ \\__\\___||___/
    `);

    console.log(logo);
  }

  public displayWelcome(version: string): void {
    console.log(
      boxen(
        `${chalk.bold.cyan("Video Notes Generator")} ${chalk.dim("v" + version)}\n\n` +
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
  }

  public startSpinner(text: string): void {
    // If there's an existing spinner, stop it properly
    this.stopSpinner();

    // If there's a progress bar, complete it first
    this.stopProgressBar();

    // Create a new spinner
    this.currentSpinner = ora({
      text: chalk.blue(text),
      spinner: "dots",
    }).start();
  }

  public updateSpinner(text: string): void {
    if (this.currentSpinner) {
      this.currentSpinner.text = chalk.blue(text);
    }
  }

  public spinnerSuccess(text: string): void {
    if (this.currentSpinner) {
      this.currentSpinner.succeed(chalk.green(text));
      this.currentSpinner = null;
    }
  }

  public spinnerFail(text: string): void {
    if (this.currentSpinner) {
      this.currentSpinner.fail(chalk.red(text));
      this.currentSpinner = null;
    }
  }

  public spinnerWarning(text: string): void {
    if (this.currentSpinner) {
      this.currentSpinner.warn(chalk.yellow(text));
      this.currentSpinner = null;
    }
  }

  public stopSpinner(): void {
    if (this.currentSpinner) {
      this.currentSpinner.stop();
      this.currentSpinner = null;
    }
  }

  public startProgressBar(total: number, text: string = "Processing"): void {
    // Stop any existing spinner or progress bar
    this.stopSpinner();
    this.stopProgressBar();

    // Create a new progress bar
    this.progressBar = new cliProgress.SingleBar({
      format: `${chalk.blue(text)} |${chalk.cyan("{bar}")}| {percentage}% | {value}/{total}`,
      barCompleteChar: "\u2588",
      barIncompleteChar: "\u2591",
      hideCursor: true,
    });

    this.progressBar.start(total, 0);
    this.isProgressBarActive = true;
  }

  public updateProgressBar(value: number, text?: string): void {
    if (this.progressBar && this.isProgressBarActive) {
      if (text) {
        (this.progressBar as any).options.format =
          `${chalk.blue(text)} |${chalk.cyan("{bar}")}| {percentage}% | {value}/{total}`;
      }
      this.progressBar.update(value);
    }
  }

  public stopProgressBar(): void {
    if (this.progressBar && this.isProgressBarActive) {
      this.progressBar.stop();
      this.isProgressBarActive = false;
      this.progressBar = null;
    }
  }

  public showSuccess(
    title: string,
    message: string,
    link?: { text: string; url: string }
  ): void {
    let content = `${chalk.green(figures.tick)} ${message}`;

    if (link) {
      const linkDisplay = terminalLink(link.text, link.url, {
        fallback: (text) => text,
      });
      content += `\n\n${linkDisplay}`;
    }

    console.log(
      boxen(content, {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: "round",
        borderColor: "green",
        title: title,
        titleAlignment: "center",
      })
    );
  }

  public showError(title: string, message: string): void {
    console.error(
      boxen(chalk.red(`${figures.cross} ${message}`), {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: "round",
        borderColor: "red",
        title: title,
        titleAlignment: "center",
      })
    );
  }

  public showInfo(title: string, message: string): void {
    console.log(
      boxen(chalk.blue(message), {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: "round",
        borderColor: "blue",
        title: title,
        titleAlignment: "center",
      })
    );
  }

  public showModelOptions(): void {
    console.log(chalk.cyan("Available AI models:"));
    console.log(chalk.white("Anthropic:"));
    console.log(
      chalk.gray(" - claude-3-opus      ") +
        chalk.dim("(most powerful, largest context)")
    );
    console.log(
      chalk.gray(" - claude-3.5-sonnet  ") +
        chalk.dim("(excellent balance of quality and speed)")
    );
    console.log(
      chalk.gray(" - claude-3.7-sonnet  ") +
        chalk.dim("(latest model, great for detailed notes)")
    );
    console.log(chalk.white("OpenAI:"));
    console.log(
      chalk.gray(" - gpt-4-turbo       ") +
        chalk.dim("(powerful with large context window)")
    );
    console.log(
      chalk.gray(" - gpt-4o            ") +
        chalk.dim("(latest and fastest GPT-4 model)")
    );
    console.log("");
  }

  public showCommandExample(): void {
    console.log(chalk.cyan("\nExample command for comprehensive notes:"));
    console.log(
      chalk.white(
        `video-notes generate -i "video.mp4" -m claude-3.7-sonnet -d exhaustive -f detailed`
      )
    );
  }

  // For dynamic live updates (useful for transcription progress)
  public liveUpdate(content: string): void {
    // Stop any existing spinner to prevent interference
    this.stopSpinner();
    logUpdate(content);
  }

  public clearLiveUpdate(): void {
    logUpdate.clear();
  }
}

// Export a singleton instance
export const ui = UIManager.getInstance();
