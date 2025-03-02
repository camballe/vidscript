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
    process.stdout.write('\x1bc');
  }

  public displayLogo(): void {
    const logo = `
  ██╗   ██╗██╗██████╗ ███████╗ ██████╗██████╗ ██╗██████╗ ████████╗
  ██║   ██║██║██╔══██╗██╔════╝██╔════╝██╔══██╗██║██╔══██╗╚══██╔══╝
  ██║   ██║██║██║  ██║███████╗██║     ██████╔╝██║██████╔╝   ██║   
  ╚██╗ ██╔╝██║██║  ██║╚════██║██║     ██╔══██╗██║██╔═══╝    ██║   
   ╚████╔╝ ██║██████╔╝███████║╚██████╗██║  ██║██║██║        ██║   
    ╚═══╝  ╚═╝╚═════╝ ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝╚═╝        ╚═╝   
                                                                  
    `;
    console.log(gradient.pastel.multiline(logo));
  }

  public displayWelcome(version: string): void {
    console.log(
      boxen(
        `Welcome to ${chalk.bold('VidScript')} ${chalk.dim(`v${version}`)}

Transform video content into intelligent, structured notes and scripts
`,
        {
          padding: 1,
          margin: 1,
          borderStyle: 'round',
          borderColor: 'cyan',
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
      boxen(
        `${chalk.green(figures.tick)} ${chalk.bold(title)}\n\n${content}`,
        {
          padding: 1,
          borderColor: 'green',
          borderStyle: 'round',
          title: 'VidScript Success',
          titleAlignment: 'center',
        }
      )
    );
  }

  public showError(title: string, message: string): void {
    console.log(
      boxen(
        `${chalk.red(figures.cross)} ${chalk.bold(title)}\n\n${message}`,
        {
          padding: 1,
          borderColor: 'red',
          borderStyle: 'round',
          title: 'VidScript Error',
          titleAlignment: 'center',
        }
      )
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
