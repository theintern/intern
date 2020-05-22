/**
 * Something that provides a log method
 */
export interface Logger {
  log(...args: unknown[]): Promise<void>;
}
