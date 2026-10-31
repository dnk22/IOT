function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export const logger = {
  info(message: string): void {
    console.info(message);
  },

  warn(message: string): void {
    console.warn(message);
  },

  error(message: string, error?: unknown): void {
    console.error(error === undefined ? message : `${message}: ${errorMessage(error)}`);
  },
};
