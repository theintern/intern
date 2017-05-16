
}

/**
 */
		}
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
export function parseJSON(json: string) {
	return JSON.parse(removeComments(json));
}

/**
 * Parse a particular type of value from a given value
 *
 * @param name The 'name' of the value being parsed (used for error messages)
 * @param value A value to parse something from
 * @param parser The type of thing to parse, or a parser function
 */
export function parseValue(name: string, value: any, parser: TypeName) {
	if (typeof parser === 'string') {
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
						return JSON.parse(value);
					}
					catch (error) {
						throw new Error(`Non-object value "${value}" for ${name}`);
					}
				}
				if (typeof value === 'object') {
					return value;
				}
				throw new Error(`Non-object value "${value}" for ${name}`);

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

			case 'object|string':
				if (typeof value === 'string') {
					if (value[0] === '{') {
						try {
							return JSON.parse(value);
						}
						catch (error) {
							throw new Error(`Invalid object string "${value}" for ${name}`);
						}
					}
					return value;
				}
				if (typeof value === 'object') {
					return value;
				}
				throw new Error(`Non-string|object value "${value}" for ${name}`);
		}
	}
	else if (typeof parser === 'function') {
		return parser(value);
	}
	else {
		throw new Error('Parser must be a type name or a function');
	}
}

export type TypeName = 'string' | 'boolean' | 'number' | 'regexp' | 'object' | 'string[]' | 'object|string';

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
 * Convert an object to JSON, handling non-primitive properties
 *
 * @param object The object to serialise.
 * @returns A JSON string
 */
export function toJSON(object: Object) {
	return JSON.stringify(object, serializeReplacer, '  ');
}

/**
 * Replacer function used in toJSON
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
