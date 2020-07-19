import { global } from '@theintern/common';

/**
 * A parsed URL
 */
export type Url = {
  protocol: string;
  hostname: string;
  port: string;
  path: string;
  query: string;
  hash: string;
};

/**
 * Indicate whether a path is absolute
 */
export function isAbsolute(path: string) {
  return path[0] === '/';
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
export function parseUrl(url: string): Url | undefined {
  if (url) {
    const match = /^(([^:/?#]+):)?(\/\/(([^:/?#]*)(:(\d+))?))?([^?#]*)(\?([^#]*))?(#(.*))?/.exec(
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
 * Resolve a path against a base path
 *
 * This is a very simply resolver that appends a path to a base, handling any
 * '..' or '.' in the path.
 */
export function resolvePath(path: string, base = '/') {
  // Normalize the path separators
  path = path.replace(/\\/g, '/');

  if (isAbsolute(path)) {
    return path;
  }

  const pathParts = path.split('/');
  const baseParts = base ? base.split('/') : [];

  // Last element will be empty if base ends with '/'
  if (baseParts[baseParts.length - 1] === '') {
    baseParts.pop();
  }

  for (const part of pathParts) {
    if (part === '..') {
      baseParts.pop();
    } else if (part !== '.') {
      baseParts.push(part);
    }
  }

  return baseParts.join('/');
}
