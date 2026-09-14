export type OutputOptions = {
  json?: boolean;
  language?: "zh-CN" | "en-US";
};

export class OutputWriter {
  constructor(private readonly options: OutputOptions = {}) {}

  result(value: unknown): void {
    if (this.options.json) {
      process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
      return;
    }
    if (typeof value === "string") {
      process.stdout.write(`${value}\n`);
      return;
    }
    process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  }

  info(message: string): void {
    process.stderr.write(`${message}\n`);
  }

  error(message: string): void {
    process.stderr.write(`${message}\n`);
  }
}
