import { Command } from 'commander';

export interface Logger {
  (...args: any[]): void;
}

interface BrowserInfo {
  [name: string]: {
    name: string;
    note?: string;
  };
}

interface CliContext {
  browsers: BrowserInfo;
  commands: { [name: string]: Command };
  program: Command;
  vlog: Logger;
  internDir: string;
  internPkg: { [key: string]: any };
  testsDir: string;
}
