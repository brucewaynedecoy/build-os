/** Invalid command or flag usage. Only the CLI adapter raises it. */
export class UsageError extends Error {
  readonly command: string;
  readonly json: boolean;

  constructor(message: string, options: { command: string; json: boolean }) {
    super(message);
    this.name = "UsageError";
    this.command = options.command;
    this.json = options.json;
  }
}
