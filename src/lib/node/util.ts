import { dirname, join, normalize } from 'path';
import { readFile, readFileSync } from 'fs';
import { loadConfig, parseArgs, splitConfigPath } from '../common/util';
import { RawSourceMap } from 'source-map';
import Task from '@dojo/core/async/Task';
import { sync as glob, hasMagic } from 'glob';
import { mixin } from '@dojo/core/lang';
import { parse } from 'shell-quote';
import global from '@dojo/shim/global';

const process = global.process;

/**
 * Expand a list of glob patterns into a flat file list. Patterns may be simple file paths or glob patterns. Patterns
 * starting with '!' denote exclusions. Note that exclusion rules will not apply to simple paths.
 */
export function expandFiles(patterns?: string[] | string) {
	if (!patterns) {
		patterns = [];
	}
	else if (!Array.isArray(patterns)) {
		patterns = [patterns];
	}

	const excludes: string[] = [];
	const includes: string[] = [];
	const paths: string[] = [];

	for (let pattern of patterns) {
		if (pattern[0] === '!') {
			excludes.push(pattern.slice(1));
		}
		else {
			if (hasMagic(pattern)) {
				includes.push(pattern);
			}
			else {
				paths.push(pattern);
			}
		}
	}

	return includes
		.map(pattern => glob(pattern, { ignore: excludes }))
		.reduce((allFiles, files) => allFiles.concat(files), paths);
}

/**
 * Get the user-supplied config data, which may include command line args and a config file.
 */
export function getConfig(configFile?: string) {
	let args: { [key: string]: any } = {};

	if (process.env['INTERN_ARGS']) {
		mixin(args, parseArgs(parse(process.env['INTERN_ARGS'])));
	}

	if (process.argv.length > 2) {
		mixin(args, parseArgs(process.argv.slice(2)));
	}

	if (configFile) {
		args.config = configFile;
	}

	if (args.config) {
		// If a config parameter was provided, load it and mix in any other command line args.
		const { configFile, childConfig } = splitConfigPath(args.config);
		return loadConfig(configFile || 'intern.json', loadText, args, childConfig);
	}
	else {
		// If no config parameter was provided, try 'intern.json', or just resolve to the original args
		return loadConfig('intern.json', loadText, args).catch((error: NodeJS.ErrnoException) => {
			if (error.code === 'ENOENT') {
				return args;
			}
			throw error;
		});
	}
}

/**
 * Normalize a path (e.g., resolve '..')
 */
export function normalizePath(path: string) {
	return normalize(path).replace(/\\/g, '/');
}

/**
 * Given a source filename, and optionally code, return the file's source map if one exists.
 */
export function readSourceMap(sourceFile: string, code?: string): RawSourceMap | undefined {
	if (!code) {
		code = readFileSync(sourceFile, { encoding: 'utf8' });
	}

	let match: RegExpMatchArray | null;

	// sourceMappingUrl must be on last line of source file; search for last newline from code.length - 2 in case the
	// file ends with a newline
	const lastNewline = code.lastIndexOf('\n', code.length - 2);
	const lastLine = code.slice(lastNewline + 1);

	if ((match = sourceMapRegEx.exec(lastLine))) {
		if (match[1]) {
			return JSON.parse((new Buffer(match[2], 'base64').toString('utf8')));
		}
		else {
			// Treat map file path as relative to the source file
			const mapFile = join(dirname(sourceFile), match[2]);
			return JSON.parse(readFileSync(mapFile, { encoding: 'utf8' }));
		}
	}
}

/**
 * Loads a text resource.
 */
function loadText(path: string) {
	return new Task<string>((resolve, reject) => {
		readFile(path, { encoding: 'utf8' }, (error, data) => {
			if (error) {
				reject(error);
			}
			else {
				resolve(data);
			}
		});
	});
}

// Regex for matching sourceMappingUrl comments
const sourceMapRegEx = /^(?:\/{2}[#@]{1,2}|\/\*)\s+sourceMappingURL\s*=\s*(data:(?:[^;]+;)+base64,)?(\S+)/;
