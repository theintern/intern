import { request, CancellablePromise, global } from '../../../common';

import {
  defaultConfig,
  getBasePath,
  loadConfig,
  parseArgs,
  splitConfigPath
} from '../common/util';

/**
 * Resolve the user-supplied config data, which may include query args and a
 * config file.
 */
export function getConfig(file?: string) {
  const args = parseArgs(parseQuery());
  const configBase = getDefaultBasePath();
  if (file) {
    args.config = file;
  }

  let load: CancellablePromise<{ [key: string]: any }>;

  if (args.config) {
    // If a config parameter was provided, load it, mix in any other query
    // params, then initialize the executor with that
    const { configFile, childConfig } = splitConfigPath(args.config);
    file = resolvePath(configFile || defaultConfig, configBase);
    load = loadConfig(file, loadText, args, childConfig);
  } else {
    // If no config parameter was provided, try 'intern.json'. If that file
    // doesn't exist, just return the args
    file = resolvePath(defaultConfig, configBase);
    load = loadConfig(file, loadText, args).catch(error => {
      if (error.message.indexOf('Request failed') === 0) {
        // The file wasn't found, clear the file name
        file = undefined;
        return args;
      }
      throw error;
    });
  }

  return load
    .then(config => {
      // If a basePath wasn't set in the config or via a query arg, and we
      // have a config file path, use that.
      if (file) {
        config.basePath = getBasePath(
          file,
          config.basePath,
          path => path[0] === '/',
          '/'
        );
      }
      return config;
    })
    .then(config => ({ config, file }));
}

/**
 * Return a base path based on the current location pathname
 */
export function getDefaultBasePath() {
  const match = /^(.*\/)node_modules\/intern\/?/.exec(global.location.pathname);
  if (match) {
    // If the current location contains `node_modules/intern`,
    // assume the base path is the parent of
    // `node_modules/intern`
    return match[1];
  } else {
    return '/';
  }
}

// TODO: Remove in the next version
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
      } else {
        result.push(part);
      }
    } else {
      result.push(part);
    }
  }

  return result.join('/');
}

/**
 * Parse a query string and return a set of decoded name=value pairs
 */
export function parseQuery(query?: string) {
  query = query || global.location.search;

  const parsed: string[] = [];
  const params = new URLSearchParams(query);
  params.forEach((value, key) => {
    // If the param in the raw query string is bare, push a bare key,
    // otherwise, push key=value.
    if (new RegExp(`\\b${key}=`).test(query!)) {
      parsed.push(`${key}=${value}`);
    } else {
      parsed.push(key);
    }
  });

  return parsed;
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
    const match = /^(([^:\/?#]+):)?(\/\/(([^:\/?#]*)(:(\d+))?))?([^?#]*)(\?([^#]*))?(#(.*))?/.exec(
      url
    );
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
function loadText(path: string): CancellablePromise<any> {
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
  if (path[0] === '/') {
    return path;
  }

  const pathParts = path.split('/');
  const basePathParts = basePath.split('/');

  if (basePathParts[basePathParts.length - 1] === '') {
    basePathParts.pop();
  }

  for (const part of pathParts) {
    if (part === '..') {
      basePathParts.pop();
    } else if (part !== '.') {
      basePathParts.push(part);
    }
  }

  return basePathParts.join('/');
}
