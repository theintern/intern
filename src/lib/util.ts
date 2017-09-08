import { constants } from 'os';
import { satisfies } from 'semver';
import {
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync
} from 'fs';
import { join } from 'path';
import { format as _format } from 'util';
import { ICommand, IExportedCommand } from 'commander';

/**
 * Ensures that a semver is contained in a range
 */
export function acceptVersion(
	version: string,
	minVersion: string,
	maxVersion?: string
) {
	let range = `>=${minVersion}`;
	if (maxVersion) {
		range += ` <${maxVersion}`;
	}
	return satisfies(version.split('-')[0], range);
}

/**
 * Collects values into an array
 */
export function collect(val: any, arr: any[]) {
	arr.push(val);
	return arr;
}

/**
 * Synchronously copies files or directories
 */
export function copy(src: string, dst: string) {
	if (statSync(src).isDirectory()) {
		try {
			mkdirSync(dst);
		} catch (error) {
			if (error.code !== 'EEXIST') {
				throw error;
			}
		}

		for (const filename of readdirSync(src)) {
			exports.copy(join(src, filename), join(dst, filename));
		}
	} else {
		const data = readFileSync(src);
		writeFileSync(dst, data);
	}
}

/**
 * Return the named command from a commander Command
 */
export function getCommand(
	name: string,
	command: IExportedCommand
): ICommand | undefined {
	for (let cmd of command.commands) {
		if (cmd.name === name) {
			return cmd;
		}
	}
}

/**
 * Ensures a value is part of an enum
 */
export function enumArg(choices: any[], val: any): any {
	if (choices.indexOf(val) === -1) {
		exports.die(
			`error: expected "${val}" to be one of {${choices.join(', ')}}`
		);
	}
	return val;
}

/**
 * Get the exit code corresponding to a signal name
 */
export function exitCodeForSignal(signalName: string) {
	return 128 + ((<any>constants.signals)[signalName] || 0);
}

/**
 * Prints a message to the console
 */
export function print(...args: any[]) {
	if (args.length === 1 && Array.isArray(args[0])) {
		console.log(format(args[0].join('\n')));
	} else {
		console.log(format(...args));
	}
}

export type Die = (...args: any[]) => void;

/**
 * Logs an error message and exits
 */
export let die = function(...args: any[]) {
	console.error();

	if (args.length === 1 && Array.isArray(args[0])) {
		console.error(format(args[0].join('\n')));
	} else {
		console.error(format(...args));
	}

	console.error();
	process.exit(1);
};

export function _setDieMethod(method: Die) {
	die = method;
}

/**
 * Returns a function that will print messages to stderr if the verbose
 * parameter is true. The function will do nothing if verbose is false.
 */
export function getLogger(verbose?: boolean) {
	if (verbose) {
		return (...args: any[]) => {
			process.stderr.write(`>> ${_format(args[0], ...args.slice(1))}\n`);
		};
	}
	return function() {};
}

/**
 * Ensures that a value is a number and returns its int value
 */
export function intArg(val: any) {
	if (isNaN(val)) {
		exports.die(`error: expected "${val}" to be a number`);
	}
	return parseInt(val, 10);
}

/**
 * Read a JSON file
 */
export function readJsonFile(file: string) {
	return JSON.parse(readFileSync(file, { encoding: 'utf8' }));
}

/**
 * Formats a string. This function works similarly to Node's `util.format`, but
 * it automatically wraps text at a given width, and prepends a prefix to all
 * lines.
 */
function format(...args: any[]) {
	if (args.length === 0) {
		return '';
	}

	const width = 80;
	const prefix = '  ';
	const message = _format(args[0], ...args.slice(1));
	const messageLines = message.split('\n');
	const lines: string[] = [];

	let line = messageLines.shift();
	while (line != null) {
		if (line.length - prefix.length <= width) {
			lines.push(prefix + line);
			line = messageLines.shift();
		} else {
			const shortLine = line.slice(0, width - prefix.length);
			const start = shortLine.search(/\S/);
			let space = shortLine.lastIndexOf(' ');
			if (space === -1 || space < start) {
				space = line.indexOf(' ', start);
			}

			if (space !== -1) {
				// Maintain the line's relative indent as well as the overall
				// indent
				const linePrefix = line.slice(0, line.search(/\S/));
				lines.push(prefix + line.slice(0, space));
				line = linePrefix + line.slice(space + 1);
			} else {
				lines.push(prefix + line);
				line = messageLines.shift();
			}
		}
	}

	return lines.join('\n');
}
