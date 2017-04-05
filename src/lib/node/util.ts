import { normalize, resolve } from 'path';
import { readFile } from 'fs';
import { parseArgs, parseJSON } from '../common/util';
import { deepMixin } from '@dojo/core/lang';
import Task from '@dojo/core/async/Task';
import Promise from '@dojo/shim/Promise';
import glob = require('glob');
import Executor from '../executors/Executor';

/**
 * Expand a list of glob patterns into a flat file list
 */
export function expandFiles(patterns?: string[]) {
	if (!Array.isArray(patterns)) {
		patterns = [patterns];
	}
	return Promise.all(patterns.map(pattern => {
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
 * Load a script or scripts using Node's require.
 *
 * @param script a path to a script
 */
export function loadScript(script: string | string[]) {
	if (!Array.isArray(script)) {
		script = [script];
	}

	script.forEach(script => {
		script = resolve(script);
		// Delete the module cache entry for the script to ensure it will be loaded and executed again.
		delete require.cache[script];
		require(script);
	});

	return Task.resolve();
}

/**
 * Normalize a path (e.g., resolve '..')
 */
export function normalizePath(path: string) {
	return normalize(path).replace(/\\/g, '/');
}

/**
 * Require a module relative to the project root (cwd)
 */
export function projectRequire(mod: string) {
	require(resolve(mod));
}

export function reportUncaughtErrors(executor: Executor) {
	process.on('unhandledRejection', (reason: Error, promise: Promise<any>) => {
		console.warn('Unhandled rejection:', promise);
		executor.emit('error', reason);
	});
	process.on('uncaughtException', (reason: Error) => {
		console.warn('Unhandled error');
		executor.emit('error', reason);
	});
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
