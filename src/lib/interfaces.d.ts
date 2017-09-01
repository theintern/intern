import { ICommand } from 'commander';

export interface Logger {
	(...args: any[]): void;
}

interface CliContext {
	program: ICommand;
	vlog: Logger;
	internDir: string;
}
