import { readSync } from "node:fs";
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
  /**
   * W1 R7 P9: reads standard input to its end, at most `limit` bytes; more
   * throws `StdinTooLargeError`. `buildos extract bulk replace-row` and
   * `decide` read their JSON here, as the skill script did.
   */
  readStdin?(limit: number): Uint8Array;
}

/** Standard input is larger than the command reads. */
export class StdinTooLargeError extends Error {
  readonly limit: number;
  constructor(limit: number) {
    super(`standard input is larger than ${limit} bytes`);
    this.name = "StdinTooLargeError";
    this.limit = limit;
  }
}

/** Reads fd 0 to its end, in chunks, at most `limit` bytes. */
export function readStdinBounded(limit: number, fd = 0): Uint8Array {
  const chunks: Uint8Array[] = [];
  let total = 0;
  const buffer = new Uint8Array(65536);
  for (;;) {
    let n: number;
    try {
      n = readSync(fd, buffer, 0, buffer.length, null);
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "EOF") break;
      if (code === "EAGAIN") {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
        continue;
      }
      throw error;
    }
    if (n === 0) break;
    total += n;
    if (total > limit) throw new StdinTooLargeError(limit);
    chunks.push(buffer.slice(0, n));
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
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
    readStdin: (limit) => readStdinBounded(limit),
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
