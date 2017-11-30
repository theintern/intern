import Task from '@dojo/core/async/Task';
import { isAbsolute, resolve, sep } from 'path';
import { parse } from 'shell-quote';
import { mixin } from '@dojo/core/lang';
import global from '@dojo/shim/global';

import Node, { Config, NodeEvents } from '../executors/Node';
import {
	evalProperty,
	getBasePath,
	loadConfig,
	parseArgs,
	parseValue,
	setOption,
	splitConfigPath
} from '../common/config';
import { loadText } from './util';

const process = global.process;

/**
 * Get the user-supplied config data, which may include command line args and a
 * config file.
 *
 * @param file A config file
 * @param argv An array of command line arguments. This should follow the same
 * format as process.argv (where user args start at index 2).
 */
export function getConfig(file?: string): Task<{ config: any; file?: string }>;
export function getConfig(
	argv?: string[]
): Task<{ config: any; file?: string }>;
export function getConfig(
	file: string,
	argv?: string[]
): Task<{ config: any; file?: string }>;
export function getConfig(fileOrArgv?: string | string[], argv?: string[]) {
	let args: { [key: string]: any } = {};
	let file = typeof fileOrArgv === 'string' ? fileOrArgv : undefined;
	argv = Array.isArray(fileOrArgv) ? fileOrArgv : argv;
	const userArgs = (argv || process.argv).slice(2);

	if (process.env['INTERN_ARGS']) {
		mixin(args, parseArgs(parse(process.env['INTERN_ARGS'] || '')));
	}

	if (userArgs.length > 0) {
		mixin(args, parseArgs(userArgs));
	}

	if (file) {
		args.config = file;
	}

	let load: Task<{ [key: string]: any }>;

	if (args.config) {
		// If a config parameter was provided, load it and mix in any other
		// command line args.
		const { configFile, childConfig } = splitConfigPath(args.config, sep);
		file = resolve(configFile || 'intern.json');
		load = loadConfig(file, loadText, args, childConfig, processOption);
	} else {
		// If no config parameter was provided, try 'intern.json', or just
		// resolve to the original args
		file = resolve('intern.json');
		load = loadConfig(file, loadText, args, undefined, processOption).catch(
			(error: NodeJS.ErrnoException) => {
				if (error.code === 'ENOENT') {
					file = undefined;
					return args;
				}
				throw error;
			}
		);
	}

	return load
		.then(config => {
			// If a basePath wasn't set in the config or via a query arg, and we
			// have a config file path, use that.
			if (file) {
				config.basePath = getBasePath(
					file,
					config.basePath,
					isAbsolute,
					sep
				);
			}
			return config;
		})
		.then(config => ({ config, file }));
}

export function processOption(
	key: keyof Config,
	value: any,
	config: Config,
	executor?: Node
) {
	const { name, addToExisting } = evalProperty<Config>(key);
	const emit = executor
		? (eventName: keyof NodeEvents, data?: any) => {
				executor.emit(eventName, data);
			}
		: (..._args: any[]) => {};

	switch (name) {
		case 'functionalBaseUrl':
		case 'serverUrl':
			setOption(config, name, parseValue(name, value, 'string'));
			return true;

		case 'proxy':
			if (value == null) {
				setOption(config, name, undefined);
			} else {
				setOption(config, name, parseValue(name, value, 'string'));
			}
			return true;

		case 'capabilities':
		case 'instrumenterOptions':
		case 'tunnelOptions':
			setOption(
				config,
				name,
				parseValue(name, value, 'object'),
				addToExisting
			);
			return true;

		// Must be a string, object, or array of (string | object)
		case 'environments':
			let _value = value;
			if (!_value) {
				_value = [];
			} else if (!Array.isArray(_value)) {
				_value = [_value];
			}
			_value = _value.map((val: any) => {
				if (typeof val === 'object' && val.browserName == null) {
					val.browserName = val.browser;
				}
				return val;
			});
			setOption(
				config,
				name,
				parseValue(name, _value, 'object[]', 'browserName'),
				addToExisting
			);
			return true;

		case 'excludeInstrumentation':
			emit('deprecated', {
				original: 'excludeInstrumentation',
				replacement: 'coverage'
			});
			return true;

		case 'tunnel':
			setOption(config, name, parseValue(name, value, 'string'));
			return true;

		case 'functionalCoverage':
		case 'leaveRemoteOpen':
		case 'serveOnly':
		case 'runInSync':
			setOption(config, name, parseValue(name, value, 'boolean'));
			return true;

		case 'coverage':
			let parsed: boolean | string[];
			try {
				parsed = parseValue(name, value, 'boolean');
			} catch (error) {
				parsed = parseValue(name, value, 'string[]');
			}
			if (typeof parsed === 'boolean' && parsed !== false) {
				throw new Error("Non-false boolean for 'coverage'");
			}
			setOption(config, name, parsed);
			return true;

		case 'functionalSuites':
			setOption(
				config,
				name,
				parseValue(name, value, 'string[]'),
				addToExisting
			);
			return true;

		case 'functionalTimeouts':
			if (!config.functionalTimeouts) {
				config.functionalTimeouts = {};
			}
			const parsedTimeout = parseValue(name, value, 'object');
			if (parsedTimeout) {
				// If the given value was an object, mix it in to the
				// default functionalTimeouts
				Object.keys(parsedTimeout).forEach(timeoutKey => {
					const key = <keyof Config['functionalTimeouts']>timeoutKey;
					if (key === 'connectTimeout') {
						emit('deprecated', {
							original: 'functionalTimeouts.connectTimeout',
							replacement: 'connectTimeout'
						});
						setOption(
							config,
							key,
							parseValue(key, parsedTimeout[key], 'number')
						);
					} else {
						config.functionalTimeouts[key] = parseValue(
							`functionalTimeouts.${key}`,
							parsedTimeout[key],
							'number'
						);
					}
				});
			} else {
				// If the given value was null/undefined, clear out
				// functionalTimeouts
				setOption(config, name, {});
			}
			return true;

		case 'connectTimeout':
		case 'maxConcurrency':
		case 'serverPort':
		case 'socketPort':
			setOption(config, name, parseValue(name, value, 'number'));
			return true;

		default:
			return false;
	}
}
