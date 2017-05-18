import { dirname, join, normalize } from 'path';
import { readFile, readFileSync } from 'fs';
import { loadConfig, parseArgs, splitConfigPath } from '../common/util';
import { mixin } from '@dojo/core/lang';
import Task from '@dojo/core/async/Task';
import { sync as glob, hasMagic } from 'glob';

/**
 * Expand a list of glob patterns into a flat file list
 */
export function expandFiles(patterns?: string[]) {
	if (!patterns) {
		patterns = [];
	}
	else if (!Array.isArray(patterns)) {
		patterns = [patterns];
	}
	return patterns.map(pattern => {
		if (hasMagic(pattern)) {
			return glob(pattern);
		}
		return [pattern];
	}).reduce((allFiles, files) => {
		return allFiles.concat(files);
	}, []);
}

/**
 * Get the user-supplied config data, which may include query args and a config file.
 */
export function getConfig() {
	const args = parseArgs(process.argv.slice(2));

	if (args.config) {
		// If a config parameter was provided, load it and mix in any other command line args.
		const { configFile, childConfig } = splitConfigPath(args.config);
		return loadConfig(configFile || 'intern.json', loadText, args, childConfig);
	}
	else {
		// If no config parameter was provided, try 'intern.json', or just resolve to the original args
		return loadConfig('intern.json', loadText).then(
			config => mixin(config, args),
			(error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') {
					return args;
				}
				throw error;
			}
		);
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
export function readSourceMap(sourceFile: string, code?: string): object | undefined {
	if (!code) {
		code = readFileSync(sourceFile, { encoding: 'utf8' });
	}

	let match: RegExpMatchArray | null;
	if ((match = sourceMapRegEx.exec(code))) {
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

const sourceMapRegEx = /(?:\/{2}[#@]{1,2}|\/\*)\s+sourceMappingURL\s*=\s*(data:(?:[^;]+;)+base64,)?(\S+)/;
