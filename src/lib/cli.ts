import * as os from 'os';
import * as semver from 'semver';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';

/**
 * Ensures that a semver is contained in a range
 */
export function acceptVersion(version: string, minVersion: string, maxVersion?: string): boolean {
	let range = '>=' + minVersion;
	if (maxVersion) {
		range += ' <=' + maxVersion;
	}
	return semver.satisfies(version.split('-')[0], range);
}

/**
 * Collects values into an array
 */
export function collect(val: any, arr: any[]): any[] {
	arr.push(val);
	return arr;
}

/**
 * Synchronously copies files or directories
 */
export function copy(src: string, dst: string): void {
	if (fs.statSync(src).isDirectory()) {
		try {
			fs.mkdirSync(dst);
		}
		catch (error) {
			if (error.code !== 'EEXIST') {
				throw error;
			}
		}

		fs.readdirSync(src).forEach(function (filename) {
			exports.copy(path.join(src, filename), path.join(dst, filename));
		});
	}
	else {
		const data = fs.readFileSync(src);
		fs.writeFileSync(dst, data);
	}
}

/**
 * Ensures a value is part of an enum
 */
export function enumArg(choices: any[], val: any): any {
	if (choices.indexOf(val) === -1) {
		exports.die('error: expected "' + val + '" to be one of {' + choices.join(', ') + '}');
	}
	return val;
}

/**
 * Get the exit code corresponding to a signal name
 */
export function exitCodeForSignal(signalName: string): number {
	return 128 + ((<any> os.constants.signals)[signalName] || 0);
}

/**
 * Prints a message to the console
 */
export function print(...args: any[]): void {
	if (args.length === 1 && Array.isArray(args[0])) {
		console.log(format((<any[]> args[0]).join('\n')));
	}
	else {
		console.log(format.apply(null, args));
	}
}

/**
 * Logs an error message and exits
 */
export let die: (...args: any[]) => void;

die = function (...args: any[]): void {
	console.error();

	if (args.length === 1 && Array.isArray(args[0])) {
		console.error(format(args[0].join('\n')));
	}
	else {
		console.error(format.apply(null, args));
	}

	console.error();
	process.exit(1);
};

export function _setDieMethod(method: (...args: any[]) => void) {
	die = method;
}

/**
 * Returns a function that will print messages to stderr if the verbose parameter is true. The function will do nothing
 * if verbose is false.
 */
export function getLogger(verbose?: boolean): Function {
	if (verbose) {
		return function (...args: any[]) {
			process.stderr.write('>> ' + util.format.apply(util, args) + '\n');
		};
	}
	return function () {};
}

/**
 * Ensures that a value is a number and returns its int value
 */
export function intArg(val: any): number {
	if (isNaN(val)) {
		exports.die('error: expected "' + val + '" to be a number');
	}
	return parseInt(val, 10);
}

/**
 * Returns a formatter function. This function works similarly to Node's `util.format`, but it automatically wraps text
 * at a given width, and prepends a prefix to all lines.
 */
function getFormatter(width: number, prefix?: string): (...args: any[]) => string {
	return function (...args: any[]) {
		const message = util.format.apply(util, args);
		const messageLines = message.split('\n');
		const lines: string[] = [];
		let line = messageLines.shift();
		while (line != null) {
			if (line.length - prefix.length <= width) {
				lines.push(prefix + line);
				line = messageLines.shift();
			}
			else {
				const shortLine = line.slice(0, width - prefix.length);
				const start = shortLine.search(/\S/);
				let space = shortLine.lastIndexOf(' ');
				if (space === -1 || space < start) {
					space = line.indexOf(' ', start);
				}

				if (space !== -1) {
					lines.push(prefix + line.slice(0, space));
					line = line.slice(space + 1);
				}
				else {
					lines.push(prefix + line);
					line = messageLines.shift();
				}
			}
		}

		return lines.join('\n');
	};
}

/**
 * Formats a string. This function is initially a stub that replaces itself with a formatter function the first time
 * it's called.
 */
let format = function (...args: any[]) {
	const formatter = getFormatter(80, '  ');
	format = formatter;
	return formatter(...args);
};
