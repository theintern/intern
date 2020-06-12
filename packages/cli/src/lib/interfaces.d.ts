import { ICommand } from 'commander';

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
	commands: { [name: string]: ICommand };
	program: ICommand;
	vlog: Logger;
	internDir: string;
	internPkg: { [key: string]: any };
	testsDir: string;
}
