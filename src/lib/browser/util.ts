import request from '@dojo/core/request/providers/xhr';
import Task from '@dojo/core/async/Task';
import { deepMixin } from '@dojo/core/lang';
import { parseArgs, parseJSON } from '../common/util';

/**
 * Resolve the user-supplied config data, which may include query args and a config file.
 */
export function getConfig() {
	const args = parseArgs(parseQuery());

	if (args.config) {
		// If a config parameter was provided, load it, mix in any other query params, then initialize the executor with
		// that
		const path = resolvePath(args.config, args.basePath);
		return loadConfig(path).then(config => deepMixin(config, args));
	}
	else {
		// If no config parameter was provided, try 'intern.json'. If that file doesn't exist, just return the args
		const path = resolvePath('intern.json', args.basePath);
		return loadConfig(path).then(
			config => deepMixin(config, args),
			_error => args
		);
	}
}

/**
 * Load a JSON resource
 */
export function loadJson(path: string, basePath?: string): Task<any> {
	if (path[0] !== '/') {
		basePath = basePath == null ? '/' : basePath;
		path = `${basePath}${path}`;
	}
	return request(path).then(response => {
		return response.text().then(text => {
			return parseJSON(text);
		});
	});
}

/**
 * Normalize a path (e.g., resolve '..')
 */
export function normalizePath(path: string) {
	const parts = path.replace(/\\/g, '/').split('/');
	let result: string[] = [];
	for (let i = 0; i < parts.length; ++i) {
		let part = parts[i];

		if (!part || part === '.') {
			if (i === 0 || i === parts.length - 1) {
				result.push('');
			}

			continue;
		}

		if (part === '..') {
			if (result.length && result[result.length - 1] !== '..') {
				result.pop();
			}
			else {
				result.push(part);
			}
		}
		else {
			result.push(part);
		}
	}

	return result.join('/');
}

/**
 * Parse a query string and return a set of decoded name=value pairs
 */
export function parseQuery(query?: string) {
	query = query || location.search.slice(1);
	return query.split('&').filter(arg => {
		return arg !== '' && arg[0] !== '=';
	}).map(arg => {
		const parts = arg.split('=');
		const name = decodeURIComponent(parts[0]);
		if (parts[1]) {
			return `${name}=${decodeURIComponent(parts[1])}`;
		}
		return name;
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

function resolvePath(path: string, basePath: string) {
	if (path[0] !== '/') {
		basePath = basePath == null ? '/' : basePath;
		path = `${basePath}${path}`;
	}
	return path;
}
