import request from '@dojo/core/request/providers/xhr';
import Task from '@dojo/core/async/Task';
import { loadConfig, parseArgs, splitConfigPath } from '../common/util';

/**
 * Resolve the user-supplied config data, which may include query args and a config file.
 */
export function getConfig(configFile?: string) {
	const args = parseArgs(parseQuery());
	if (configFile) {
		args.config = configFile;
	}

	if (args.config) {
		// If a config parameter was provided, load it, mix in any other query params, then initialize the executor with
		// that
		const { configFile, childConfig } = splitConfigPath(args.config);
		const path = resolvePath(configFile || 'intern.json', args.basePath);
		return loadConfig(path, loadText, args, childConfig);
	}
	else {
		// If no config parameter was provided, try 'intern.json'. If that file doesn't exist, just return the args
		const path = resolvePath('intern.json', args.basePath);
		return loadConfig(path, loadText, args).catch(error => {
			if (error.message.indexOf('Request failed') === 0) {
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
		else if (parts.length > 1) {
			return `${name}=`;
		}
		return name;
	});
}

/**
 * Parse a URL
 */
export type Url = {
	protocol: string;
	hostname: string;
	port: string;
	path: string;
	query: string;
	hash: string;
};
export function parseUrl(url: string): Url | undefined {
	if (url) {
		const match = /^(([^:\/?#]+):)?(\/\/(([^:\/?#]*)(:(\d+))?))?([^?#]*)(\?([^#]*))?(#(.*))?/.exec(url);
		if (match) {
			return {
				protocol: match[2],
				hostname: match[5],
				port: match[7],
				path: match[8],
				query: match[10],
				hash: match[12]
			};
		}
	}
}

/**
 * Load a text resource
 */
function loadText(path: string): Task<any> {
	return request(path).then(response => {
		if (!response.ok) {
			throw new Error('Request failed: ' + response.status);
		}
		return response.text();
	});
}

/**
 * Resolve a path against a base path
 */
function resolvePath(path: string, basePath: string) {
	if (path[0] !== '/') {
		basePath = basePath == null ? '/' : basePath;
		path = `${basePath}${path}`;
	}
	return path;
}
