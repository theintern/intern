import { InternError } from '../types';

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
  const removed: T[] = [];
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
export function stringify(object: any, indent?: string) {
  return JSON.stringify(object, serializeReplacer, indent);
}

// ============================================================================
// support functions

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

export function errorToJSON(error?: InternError): InternError | undefined {
  if (!error) {
    return undefined;
  }
  const {
    name,
    message,
    stack,
    lifecycleMethod,
    showDiff,
    actual,
    expected
  } = error;

  return {
    name,
    message,
    stack,
    ...(lifecycleMethod ? { lifecycleMethod } : {}),
    showDiff: Boolean(showDiff),
    ...(showDiff ? { actual, expected } : {})
  };
}
