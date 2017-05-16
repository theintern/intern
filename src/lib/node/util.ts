import { dirname, join, normalize } from 'path';
import { readFile, readFileSync } from 'fs';
import { parseArgs, parseJSON } from '../common/util';
import { deepMixin } from '@dojo/core/lang';
import Task from '@dojo/core/async/Task';
import Promise from '@dojo/shim/Promise';
import glob = require('glob');

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
	return Promise.all(patterns.map(pattern => {
		if (glob.hasMagic(pattern)) {
			return new Promise<string[]>((resolve, reject) => {
				glob(pattern, (error, files) => {
					if (error) {
						reject(error);
					}
					else {
						resolve(files);
					}
				});
			});
		}
		return [pattern];
	})).then(fileSets => {
		return fileSets.reduce((allFiles, files) => {
			return allFiles.concat(files);
		}, []);
	});
}

/**
 * Get the user-supplied config data, which may include query args and a config file.
 */
export function getConfig() {
	const args = parseArgs(process.argv.slice(2));

	if (args.config) {
		// If a config parameter was provided, load it and mix in any other command line args.
		return loadConfig(args.config).then(config => deepMixin(config, args));
	}
	else {
		// If no config parameter was provided, try 'intern.json', or just resolve to the original args
		return loadConfig('intern.json').then(
			config => deepMixin(config, args),
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
 * Loads a text resource.
 *
 * @param resource a path to a text resource
 */
export function loadJson(resource: string): Task<any> {
	return loadText(resource).then(data => parseJSON(data));
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

function loadConfig(configPath: string): Promise<any> {
	return loadJson(configPath).then(config => {
		if (config.extends) {
			const parts = configPath.split('/');
			const extensionPath = parts.slice(0, parts.length - 1).concat(config.extends).join('/');
			return loadConfig(extensionPath).then(extension => {
				return deepMixin(extension, config);
			});
		}
		else {
			return config;
		}
	});
}

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
