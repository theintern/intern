import Task from '@dojo/core/async/Task';

export interface TextLoader {
	(path: string): Task<string>;
}

/**
 * Return a string with all lines prefixed with a given prefix.
 */
export function prefix(message: string, prefix: string) {
	return message
		.split('\n')
		.map(line => prefix + line)
		.join('\n');
}

/**
 * Remove all instances of of an item from any array and return the removed
 * instances.
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
 * Check if a value is a Task without directly accessing any non-existent
 * properties.
 *
 * Checking in this way is necessary when using libraries that validate property
 * accesses such as ChaiAsPromised.
 */
export function isTask<T = any>(value: any): value is Task<T> {
	if (!value || typeof value !== 'object') {
		return false;
	}
	for (const name of ['then', 'catch', 'finally', 'cancel']) {
		if (!(name in value) || typeof value[name] !== 'function') {
			return false;
		}
	}
	return true;
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
