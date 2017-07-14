import { mixin } from '@dojo/core/lang';
import Task from '@dojo/core/async/Task';

const configPathSeparator = '@';

export interface TextLoader {
	(path: string): Task<string>;
}

/**
 * Return a string with all lines prefixed with a given prefix.
 */
export function prefix(message: string, prefix: string) {
	return message.split('\n').map(line => prefix + line).join('\n');
}

/**
 * Load config data from a given path, using a given text loader, and mixing args and/or a childConfig into the final
 * config value if provided.
 */
export function loadConfig(configPath: string, loadText: TextLoader, args?: { [key: string]: any }, childConfig?: string | string[]): Task<any> {
	return _loadConfig(configPath, loadText, args, childConfig).then(config => {
		// 'config' and 'extends' are only applicable to the config loader, not the Executors
		delete config.config;
		delete config.extends;

		if (!args || !args.showConfigs) {
			// 'configs' is only relevant if we're showing configs
			delete config.configs;
		}

		return config;
	});
}

function _loadConfig(configPath: string, loadText: TextLoader, args?: { [key: string]: any }, childConfig?: string | string[]): Task<any> {
	return loadText(configPath).then(text => {
		const config = parseJson(text);
		// extends paths are assumed to be relative and use '/'
		if (config.extends) {
			const parts = configPath.split('/');
			const { configFile, childConfig } = splitConfigPath(config.extends);
			const extensionPath = parts.slice(0, parts.length - 1).concat(configFile).join('/');
			return _loadConfig(extensionPath, loadText, undefined, childConfig).then(extension => {
				// Copy all keys except 'configs' from the config to the thing its extending (shallow mixin)
				Object.keys(config).filter(key => key !== 'configs').forEach(key => {
					extension[key] = config[key];
				});
				// If config has a 'configs' property, mix its values into extension.configs (slightly deeper mixin)
				if (config.configs) {
					if (extension.configs == null) {
						extension.configs = {};
					}
					Object.keys(config.configs).forEach(key => {
						extension.configs[key] = config.configs[key];
					});
				}
				return extension;
			});
		}
		return config;
	}).then(config => {
		if (args && args.showConfigs) {
			// If we're showing the configs, don't mix in children
			return config;
		}

		if (childConfig) {
			const mixinConfig = (childConfig: string | string[]) => {
				const configs = Array.isArray(childConfig) ? childConfig : [ childConfig ];
				configs.forEach(childConfig => {
					const child = config.configs[childConfig];
					if (!child) {
						throw new Error(`Unknown child config "${childConfig}"`);
					}
					if (child.extends) {
						mixinConfig(child.extends);
					}

					// Mix the child into the current config. Properties other than the environment resource keys
					// ('node' and 'browser') will replace values on the parent. The environment resource objects will
					// be mixed into the corresponding objects on the parent.
					Object.keys(child)
						.filter(key => key !== 'node' && key !== 'browser')
						.forEach(key => {
							config[key] = child[key];
						});

					['node', 'browser'].forEach(key => {
						if (child[key]) {
							if (config[key]) {
								mixin(config[key], child[key]);
							}
							else {
								config[key] = child[key];
							}
						}
					});
				});
			};

			mixinConfig(childConfig);
		}
		return config;
	}).then(config => {
		if (args) {
			mixin(config, args);

			// If any non-additive resources are specified in args, they will apply to all environments and will
			// override any environment specific resources.
			[ 'plugins', 'reporters', 'require', 'suites' ].filter(property => {
				return property in args;
			}).forEach(property => {
				[ 'node', 'browser' ].filter(environment => {
					return config[environment];
				}).forEach(environment => {
					delete config[environment][property];
				});
			});
		}
		return config;
	});
}

export function getConfigDescription(config: any) {
	let description = '';

	if (config.description) {
		description += `${config.description}\n\n`;
	}

	if (config.configs) {
		description += `Configs:\n`;
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
			return line;
		});

		description += lines.join('\n');
	}

	return description;
}

/**
 * Normalize a path such that it ends in '/'
 */
export function normalizePathEnding(path: string) {
	if (path && path.length > 0 && path[path.length - 1] !== '/') {
		return `${path}/`;
	}
	return path;
}

/**
 * Parse an array of name=value arguments into an object
 */
export function parseArgs(rawArgs: string[]) {
	const args: { [key: string]: any } = {};
	rawArgs.forEach(arg => {
		let [name, value] = arg.split('=', 2);

		if (typeof value === 'undefined') {
			args[name] = true;
		}
		else {
			if (!(name in args)) {
				args[name] = value;
			}
			else if (!Array.isArray(args[name])) {
				args[name] = [args[name], value];
			}
			else {
				args[name].push(value);
			}
		}
	});

	return args;
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
export function parseValue(name: string, value: any, parser: TypeName | Parser, requiredProperty?: string) {
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
					value = JSON.parse(value);
				}
				catch (error) {
					if (!requiredProperty) {
						throw new Error(`Non-object value "${value}" for ${name}`);
					}
					value = { [requiredProperty]: value };
				}
			}
			// A value of type 'object' should be a simple object, not a built-in type like RegExp or Array
			if (Object.prototype.toString.call(value) === '[object Object]') {
				if (requiredProperty && !value[requiredProperty]) {
					throw new Error(`Invalid value "${JSON.stringify(value)}" for ${name}: missing '${requiredProperty}' property`);
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
			if (Array.isArray(value) && value.every(v => typeof v === 'string')) {
				return value;
			}
			throw new Error(`Non-string[] value "${value}" for ${name}`);

		default:
			if (typeof parser === 'function') {
				return parser(value);
			}
			else {
				throw new Error('Parser must be a valid type name');
			}
	}
}

export type TypeName = 'string' | 'boolean' | 'number' | 'regexp' | 'object' | 'string[]' | 'object[]';
export type Parser<T = any> = (value: any) => T;

/**
 * Remove all instances of of an item from any array and return the removed instances.
 */
export function pullFromArray<T>(haystack: T[], needle: T): T[] {
	let removed: T[] = [];
	let i = 0;

	while ((i = haystack.indexOf(needle, i)) > -1) {
		removed.push(haystack.splice(i, 1)[0]);
	}

	return removed;
}

/**
 * Split a config path into a file name and a child config name.
 */
export function splitConfigPath(path: string): { configFile: string, childConfig?: string } {
	const [ configFile, childConfig ] = path.split(configPathSeparator, 2);
	return { configFile, childConfig };
}

/**
 * Convert an object to JSON, handling non-primitive properties
 *
 * @param object The object to serialise.
 * @returns A JSON string
 */
export function stringify(object: Object, indent?: string) {
	return JSON.stringify(object, serializeReplacer, indent);
}

/**
 * Replacer function used in stringify
 */
function serializeReplacer(_key: string, value: any) {
	if (!value) {
		return value;
	}

	if (value instanceof RegExp) {
		return value.source;
	}

	if (typeof value === 'function') {
		return value.toString();
	}

	return value;
}

/**
 * Remove JS-style line and block comments from a string
 */
function removeComments(text: string) {
	let state: 'string' | 'block-comment' | 'line-comment' | 'default' = 'default';
	let i = 0;

	// Create an array of chars from the text, the blank out anything in a comment
	const chars = text.split('');

	while (i < chars.length) {
		switch (state) {
			case 'block-comment':
				if (chars[i] === '*' && chars[i + 1] === '/') {
					chars[i] = ' ';
					chars[i + 1] = ' ';
					state = 'default';
					i += 2;
				}
				else if (chars[i] !== '\n') {
					chars[i] = ' ';
					i += 1;
				}
				else {
					i += 1;
				}
				break;

			case 'line-comment':
				if (chars[i] === '\n') {
					state = 'default';
				}
				else {
					chars[i] = ' ';
				}
				i += 1;
				break;

			case 'string':
				if (chars[i] === '"') {
					state = 'default';
					i += 1;
				}
				else if (chars[i] === '\\' && chars[i + 1] === '\\') {
					i += 2;
				}
				else if (chars[i] === '\\' && chars[i + 1] === '"') {
					i += 2;
				}
				else {
					i += 1;
				}
				break;

			default:
				if (chars[i] === '"') {
					state = 'string';
					i += 1;
				}
				else if (chars[i] === '/' && chars[i + 1] === '*') {
					chars[i] = ' ';
					chars[i + 1] = ' ';
					state = 'block-comment';
					i += 2;
				}
				else if (chars[i] === '/' && chars[i + 1] === '/') {
					chars[i] = ' ';
					chars[i + 1] = ' ';
					state = 'line-comment';
					i += 2;
				}
				else {
					i += 1;
				}
		}
	}

	return chars.join('');
}
