import { deepMixin, mixin } from '@dojo/core/lang';
import Task from '@dojo/core/async/Task';

import {
	Config,
	Events,
	Executor,
	PluginDescriptor,
	ResourceConfig
} from '../executors/Executor';
import { getPathSep, join, normalize } from './path';
import { TextLoader } from './util';

export interface EvaluatedProperty<C extends Config = Config> {
	name: keyof C;
	addToExisting: boolean;
}

export type OptionProcessor<C extends Config> = (
	key: keyof C,
	value: any,
	config: C
) => boolean;

export type TypeName =
	| 'string'
	| 'boolean'
	| 'number'
	| 'regexp'
	| 'object'
	| 'string[]'
	| 'object[]';

export type Parser<T = any> = (value: any) => T;

/**
 * Evaluate a config property key
 */
export function evalProperty<C extends Config>(
	key: string
): EvaluatedProperty<C> {
	const addToExisting = key[key.length - 1] === '+';
	const name = <keyof C>(addToExisting
		? <keyof C>key.slice(0, key.length - 1)
		: key);
	return { name, addToExisting };
}

/**
 * Get the base path based on a config file path and a user-supplied base path.
 *
 * The path separator will be normalized based on the separator used in
 * configFile or basePath and the optional pathSep arg.
 */
export function getBasePath(
	configFile: string,
	basePath: string,
	isAbsolute: (path: string) => boolean,
	pathSep?: string
) {
	pathSep = pathSep || getPathSep(configFile, basePath);

	// initialBasePath is the path containing the config file
	const configPathParts = configFile.replace(/\\/g, '/').split('/');
	let initialBasePath: string;

	if (configFile[0] === '/' && configPathParts.length === 2) {
		initialBasePath = '/';
	} else {
		initialBasePath = configPathParts.slice(0, -1).join('/');
	}

	let finalBasePath: string;

	if (basePath) {
		basePath = normalize(basePath);

		if (isAbsolute(basePath)) {
			// basePath is absolute, so use it directly
			finalBasePath = basePath;
		} else {
			// basePath is relative, so resolve it against initialBasePath
			finalBasePath = join(initialBasePath, basePath);
		}
	} else {
		// No basePath was provided, so use initialBasePath
		finalBasePath = initialBasePath;
	}

	return finalBasePath.split('/').join(pathSep);
}

/**
 * Return a string describing a config file, including any child configs.
 */
export function getConfigDescription(config: any, prefix = '') {
	let description = '';

	if (config.description) {
		description += `${prefix}${config.description}\n\n`;
	}

	if (config.configs) {
		description += `${prefix}Configs:\n`;
		const width = Object.keys(config.configs).reduce((width, name) => {
			return Math.max(width, name.length);
		}, 0);
		const lines = Object.keys(config.configs).map(name => {
			const child = config.configs[name];
			while (name.length < width) {
				name += ' ';
			}
			let line = `  ${name}`;
			if (child.description) {
				line += ` (${child.description})`;
			}
			return `${prefix}${line}`;
		});

		description += lines.join('\n');
	}

	return description;
}

/**
 * Load config data from a given path, using a given text loader, and mixing
 * args and/or a childConfig into the final config value if provided.
 */
export function loadConfig<C extends Config>(
	configPath: string,
	loadText: TextLoader,
	args?: { [key: string]: any },
	childConfig?: string | string[],
	processOpt?: OptionProcessor<C>
): Task<any> {
	const _processOption = processOpt || processOption;

	return _loadConfig(
		configPath,
		loadText,
		_processOption,
		args,
		childConfig
	).then(config => {
		// 'config' and 'extends' are only applicable to the config loader, not
		// the Executors
		delete config.config;
		delete config.extends;

		if (!(args && (args.showConfigs || args.help))) {
			// 'configs' is only relevant if we're showing configs
			delete config.configs;
		}

		return config;
	});
}

/**
 * Parse an array of name=value arguments into an object
 */
export function parseArgs(rawArgs: string[]) {
	const parsedArgs: { [key: string]: any } = {};

	for (const arg of rawArgs) {
		let name = arg;
		let value: string | undefined;
		let args = parsedArgs;

		const eq = arg.indexOf('=');
		if (eq !== -1) {
			name = arg.slice(0, eq);
			value = arg.slice(eq + 1);
		}

		if (name.indexOf('.') !== -1) {
			const parts = name.split('.');
			const head = parts.slice(0, parts.length - 1);
			name = parts[parts.length - 1];

			for (const part of head) {
				if (!args[part]) {
					args[part] = {};
				}
				args = args[part];
			}
		}

		if (typeof value === 'undefined') {
			args[name] = true;
		} else {
			if (!(name in args)) {
				args[name] = value;
			} else if (!Array.isArray(args[name])) {
				args[name] = [args[name], value];
			} else {
				args[name].push(value);
			}
		}
	}

	return parsedArgs;
}

/**
 * Parse a JSON string that may contain comments
 */
export function parseJson(json: string) {
	return JSON.parse(removeComments(json));
}

/**
 * Parse a particular type of value from a given value
 *
 * @param name The 'name' of the value being parsed (used for error messages)
 * @param value A value to parse something from
 * @param parser The type of thing to parse, or a parser function
 * @param requiredProperty Only used with 'object' and 'object[]' parsers
 */
export function parseValue(
	name: string,
	value: any,
	parser: TypeName | Parser,
	requiredProperty?: string
) {
	switch (parser) {
		case 'boolean':
			if (typeof value === 'boolean') {
				return value;
			}
			if (value === 'true') {
				return true;
			}
			if (value === 'false') {
				return false;
			}
			throw new Error(`Non-boolean value "${value}" for ${name}`);

		case 'number':
			const numValue = Number(value);
			if (!isNaN(numValue)) {
				return numValue;
			}
			throw new Error(`Non-numeric value "${value}" for ${name}`);

		case 'regexp':
			if (typeof value === 'string') {
				return new RegExp(value);
			}
			if (value instanceof RegExp) {
				return value;
			}
			throw new Error(`Non-regexp value "${value}" for ${name}`);

		case 'object':
			if (typeof value === 'string') {
				try {
					value = value ? JSON.parse(value) : {};
				} catch (error) {
					if (!requiredProperty) {
						throw new Error(
							`Non-object value "${value}" for ${name}`
						);
					}
					value = { [requiredProperty]: value };
				}
			}
			// A value of type 'object' should be a simple object, not a
			// built-in type like RegExp or Array
			if (Object.prototype.toString.call(value) === '[object Object]') {
				if (requiredProperty && !value[requiredProperty]) {
					throw new Error(
						`Invalid value "${JSON.stringify(value)}" for ${
							name
						}: missing '${requiredProperty}' property`
					);
				}
				return value;
			}
			throw new Error(`Non-object value "${value}" for ${name}`);

		case 'object[]':
			if (!value) {
				value = [];
			}
			if (!Array.isArray(value)) {
				value = [value];
			}
			return value.map((item: any) => {
				return parseValue(name, item, 'object', requiredProperty);
			});

		case 'string':
			if (typeof value === 'string') {
				return value;
			}
			throw new Error(`Non-string value "${value}" for ${name}`);

		case 'string[]':
			if (!value) {
				value = [];
			}
			if (typeof value === 'string') {
				value = [value];
			}
			if (
				Array.isArray(value) &&
				value.every(v => typeof v === 'string')
			) {
				return value;
			}
			throw new Error(`Non-string[] value "${value}" for ${name}`);

		default:
			if (typeof parser === 'function') {
				return parser(value);
			} else {
				throw new Error('Parser must be a valid type name');
			}
	}
}

/**
 * Process a Config option, transforming it to a canonical form and storing it
 * on the given config object.
 *
 * If an executor is provided, it will be used to emit deprecation and log
 * events.
 */
export function processOption<C extends Config>(
	key: keyof C,
	value: any,
	config: C,
	executor?: Executor
) {
	const { name, addToExisting } = evalProperty(key);
	const emit = executor
		? (eventName: keyof Events, data?: any) => {
				executor.emit(eventName, data);
			}
		: (..._args: any[]) => {};

	switch (name) {
		case 'loader':
			setOption(
				config,
				name,
				parseValue(name, value, 'object', 'script')
			);
			break;

		case 'bail':
		case 'baseline':
		case 'benchmark':
		case 'debug':
		case 'filterErrorStack':
		case 'showConfig':
			setOption(config, name, parseValue(name, value, 'boolean'));
			break;

		case 'basePath':
		case 'coverageVariable':
		case 'description':
		case 'internPath':
		case 'name':
		case 'sessionId':
			setOption(config, name, parseValue(name, value, 'string'));
			break;

		case 'defaultTimeout':
			setOption(config, name, parseValue(name, value, 'number'));
			break;

		case 'grep':
			setOption(config, name, parseValue(name, value, 'regexp'));
			break;

		case 'reporters':
			setOption(
				config,
				name,
				parseValue(name, value, 'object[]', 'name'),
				addToExisting
			);
			break;

		case 'plugins':
		case 'requires':
		case 'require':
		case 'scripts':
			let useLoader = false;
			let _name = name;
			if (name === 'scripts') {
				emit('deprecated', {
					original: 'scripts',
					replacement: 'plugins'
				});
				_name = 'plugins';
			} else if (name === 'require') {
				emit('deprecated', {
					original: 'require',
					replacement: 'plugins'
				});
				_name = 'plugins';
			} else if (name === 'requires') {
				emit('deprecated', {
					original: 'require',
					replacement: 'plugins',
					message: 'Set `useLoader: true`'
				});
				_name = 'plugins';
				useLoader = true;
			}
			const parsed = parseValue(_name, value, 'object[]', 'script');
			if (useLoader) {
				parsed.forEach((entry: PluginDescriptor) => {
					entry.useLoader = true;
				});
			}
			setOption(config, _name, parsed, addToExisting);
			break;

		case 'suites':
			setOption(
				config,
				name,
				parseValue(name, value, 'string[]'),
				addToExisting
			);
			break;

		case 'node':
		case 'browser':
			const envConfig: ResourceConfig = config[name] || {};
			if (!config[name]) {
				config[name] = envConfig;
			}
			const envName = name;
			const _value = parseValue(name, value, 'object');
			if (_value) {
				Object.keys(_value).forEach(valueKey => {
					const key = <keyof ResourceConfig>valueKey;
					let resource = _value[key];
					let { name, addToExisting } = evalProperty(key);
					switch (name) {
						case 'loader':
							resource = parseValue(
								name,
								resource,
								'object',
								'script'
							);
							setOption(<C>envConfig, name, resource, false);
							break;
						case 'reporters':
							resource = parseValue(
								'reporters',
								resource,
								'object[]',
								'name'
							);
							setOption(
								<C>envConfig,
								name,
								resource,
								addToExisting
							);
							break;
						case 'plugins':
						case 'require':
						case 'requires':
						case 'scripts':
							let useLoader = false;
							if (name === 'scripts') {
								emit('deprecated', {
									original: 'scripts',
									replacement: 'plugins'
								});
								name = 'plugins';
							} else if (name === 'require') {
								emit('deprecated', {
									original: 'require',
									replacement: 'plugins'
								});
								name = 'plugins';
							} else if (name === 'requires') {
								emit('deprecated', {
									original: 'requires',
									replacement: 'plugins',
									message: 'Set `useLoader: true`'
								});
								name = 'plugins';
								useLoader = true;
							}
							resource = parseValue(
								name,
								resource,
								'object[]',
								'script'
							);
							if (useLoader) {
								resource.forEach((entry: PluginDescriptor) => {
									entry.useLoader = true;
								});
							}
							setOption(
								<C>envConfig,
								<keyof C>name,
								resource,
								addToExisting
							);
							break;
						case 'suites':
							resource = parseValue(name, resource, 'string[]');
							setOption(
								<C>envConfig,
								name,
								resource,
								addToExisting
							);
							break;
						default:
							throw new Error(
								`Invalid property ${key} in ${envName} config`
							);
					}
				});
			}
			break;

		default:
			emit('log', `Config has unknown option "${name}"`);
			setOption(config, name, value);
	}

	return true;
}

/**
 * Remove JS-style line and block comments from a string
 */
function removeComments(text: string) {
	let state: 'string' | 'block-comment' | 'line-comment' | 'default' =
		'default';
	let i = 0;

	// Create an array of chars from the text, the blank out anything in a
	// comment
	const chars = text.split('');

	while (i < chars.length) {
		switch (state) {
			case 'block-comment':
				if (chars[i] === '*' && chars[i + 1] === '/') {
					chars[i] = ' ';
					chars[i + 1] = ' ';
					state = 'default';
					i += 2;
				} else if (chars[i] !== '\n') {
					chars[i] = ' ';
					i += 1;
				} else {
					i += 1;
				}
				break;

			case 'line-comment':
				if (chars[i] === '\n') {
					state = 'default';
				} else {
					chars[i] = ' ';
				}
				i += 1;
				break;

			case 'string':
				if (chars[i] === '"') {
					state = 'default';
					i += 1;
				} else if (chars[i] === '\\' && chars[i + 1] === '\\') {
					i += 2;
				} else if (chars[i] === '\\' && chars[i + 1] === '"') {
					i += 2;
				} else {
					i += 1;
				}
				break;

			default:
				if (chars[i] === '"') {
					state = 'string';
					i += 1;
				} else if (chars[i] === '/' && chars[i + 1] === '*') {
					chars[i] = ' ';
					chars[i + 1] = ' ';
					state = 'block-comment';
					i += 2;
				} else if (chars[i] === '/' && chars[i + 1] === '/') {
					chars[i] = ' ';
					chars[i + 1] = ' ';
					state = 'line-comment';
					i += 2;
				} else {
					i += 1;
				}
		}
	}

	return chars.join('');
}

/**
 * Set an option value.
 */
export function setOption<C extends Config>(
	config: C,
	name: keyof C,
	value: any,
	addToExisting = false
) {
	if (addToExisting) {
		const currentValue: any = config[name];
		if (currentValue == null) {
			config[name] = value;
		} else if (Array.isArray(currentValue)) {
			currentValue.push(...value);
		} else if (typeof config[name] === 'object') {
			config[name] = deepMixin({}, config[name], value);
		} else {
			throw new Error('Only array or object options may be added');
		}
	} else {
		config[name] = value;
	}
}

/**
 * Split a config path into a file name and a child config name.
 *
 * This allows for the case where a file name itself may include the config
 * separator (e.g., a scoped npm package).
 */
export function splitConfigPath(
	path: string,
	separator = '/'
): { configFile: string; childConfig?: string } {
	const lastSep = path.lastIndexOf(configPathSeparator);
	if (lastSep === 0) {
		// path is like '@foo' -- specifies a child config
		return { configFile: '', childConfig: path.slice(1) };
	}
	if (lastSep === -1 || path[lastSep - 1] === separator) {
		// path is like 'foo' or 'node_modules/@foo' -- specifies a
		// path
		return { configFile: path };
	}

	// path is like 'foo@bar' or 'node_modules/@foo@bar' -- specifies a path and
	// a child config
	return {
		configFile: path.slice(0, lastSep),
		childConfig: path.slice(lastSep + 1)
	};
}

// ============================================================================
// support functions

function _loadConfig<C extends Config>(
	configPath: string,
	loadText: TextLoader,
	processOpt: OptionProcessor<C>,
	args?: { [key: string]: any },
	childConfig?: string | string[]
): Task<any> {
	const _setOption = (option: keyof C, value: any, target: any) => {
		if (!processOpt(option, value, target)) {
			processOption(option, value, target);
		}
	};

	return loadText(configPath)
		.then(text => {
			const preConfig = parseJson(text);

			// extends paths are assumed to be relative and use '/'
			if (preConfig.extends) {
				const parts = configPath.split('/');
				const { configFile, childConfig } = splitConfigPath(
					preConfig.extends
				);
				const extensionPath = parts
					.slice(0, parts.length - 1)
					.concat(configFile)
					.join('/');

				return _loadConfig(
					extensionPath,
					loadText,
					processOpt,
					undefined,
					childConfig
				).then(extension => {
					// Process all keys except 'configs' from the config to the
					// thing it's extending
					Object.keys(preConfig)
						.filter(key => key !== 'configs')
						.forEach(key => {
							_setOption(<keyof C>key, preConfig[key], extension);
						});

					// If config has a 'configs' property, mix its values into
					// extension.configs (slightly deeper mixin)
					if (preConfig.configs) {
						if (extension.configs == null) {
							extension.configs = {};
						}
						Object.keys(preConfig.configs).forEach(key => {
							extension.configs[key] = preConfig.configs[key];
						});
					}
					return extension;
				});
			} else {
				const config: any = {};
				Object.keys(preConfig).forEach(key => {
					_setOption(<keyof C>key, preConfig[key], config);
				});
				return config;
			}
		})
		.then(config => {
			if (args && (args.showConfigs || args.help)) {
				// If we're showing the configs, don't mix in children
				return config;
			}

			if (childConfig) {
				const mixinConfig = (childConfig: string | string[]) => {
					const configs = Array.isArray(childConfig)
						? childConfig
						: [childConfig];
					configs.forEach(childConfig => {
						const child = config.configs[childConfig];
						if (!child) {
							throw new Error(
								`Unknown child config "${childConfig}"`
							);
						}
						if (child.extends) {
							mixinConfig(child.extends);
						}

						// Mix the child into the current config. Properties
						// other than the environment resource keys ('node' and
						// 'browser') will replace values on the parent. The
						// environment resource objects will be mixed into the
						// corresponding objects on the parent.
						Object.keys(child)
							.filter(key => key !== 'node' && key !== 'browser')
							.forEach(key => {
								_setOption(<keyof C>key, child[key], config);
							});

						['node', 'browser'].forEach(key => {
							if (child[key]) {
								if (config[key]) {
									// Run the environment config through
									// setOption, then mix it into the main
									// config
									const envConfig: any = {};
									_setOption(
										<keyof C>key,
										child[key],
										envConfig
									);
									mixin(config[key], envConfig[key]);
								} else {
									_setOption(
										<keyof C>key,
										child[key],
										config
									);
								}
							}
						});
					});
				};

				mixinConfig(childConfig);
			}
			return config;
		})
		.then(config => {
			if (args) {
				// If any non-additive resources are specified in args, they
				// will apply to all environments and will override any
				// environment specific resources.
				const resources: (keyof ResourceConfig)[] = [
					'plugins',
					'reporters',
					'suites'
				];
				resources
					.filter(resource => resource in args)
					.forEach(resource => {
						const environments: (keyof Config)[] = [
							'node',
							'browser'
						];
						environments
							.filter(environment => config[environment])
							.forEach(environment => {
								delete config[environment][resource];
							});
					});

				Object.keys(args).forEach(key => {
					_setOption(<keyof C>key, args[key], config);
				});
			}
			return config;
		});
}

const configPathSeparator = '@';
