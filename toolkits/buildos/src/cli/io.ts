import { createInterface } from "node:readline";
import { goGetwd } from "../adapters/node-fs.ts";

/** The process streams and context the CLI writes to. Tests pass fakes. */
export interface CliIo {
  writeStdout(text: string): void;
  writeStderr(text: string): void;
  cwd: string;
  /** True when a person can answer a question: stdin and stderr are terminals. Default: false. */
  interactive?: boolean;
  /** Writes `question` to stderr and reads one line of answer; `undefined` at the end of input. */
  prompt?(question: string): Promise<string | undefined>;
}

export function processIo(): CliIo {
  return {
    writeStdout: (text) => {
      process.stdout.write(text);
    },
    writeStderr: (text) => {
      process.stderr.write(text);
    },
    // Go's os.Getwd: `$PWD` when it names the current folder (W1 R7 P3 t12).
    cwd: goGetwd(),
    interactive: process.stdin.isTTY === true && process.stderr.isTTY === true,
    prompt: (question) => promptLine(question),
  };
}

function promptLine(question: string): Promise<string | undefined> {
  return new Promise((resolveAnswer) => {
    const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
    let answered = false;
    rl.question(question, (answer) => {
      answered = true;
      rl.close();
      resolveAnswer(answer);
    });
    rl.on("close", () => {
      if (!answered) {
        process.stderr.write("\n");
        resolveAnswer(undefined);
      }
    });
  });
}
