import { global, request } from '../../../common';
import { dirname } from '../common/path';
import {
  ConfiguratorOptions,
  createConfigurator as configCreateConfigurator
} from '../config';
import { isAbsolute, resolvePath } from './util';

/**
 * The configurator singleton that should be used to load and manage Config
 * objects
 */
export function createConfigurator(options: Partial<ConfiguratorOptions>) {
  return configCreateConfigurator({
    loadText,
    resolvePath,
    dirname,
    isAbsolute,
    defaultBasePath: getDefaultBasePath(),
    sep: '/',
    ...options
  });
}

/**
 * Return a base path based on the current location pathname
 */
export function getDefaultBasePath(): string {
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

/**
 * Return the path to Intern
 */
export function getDefaultInternPath() {
  const scripts = global.document.scripts;
  for (let i = 0; i < scripts.length; i++) {
    const scriptPath = scripts[i].src;
    if (/browser\/intern.js/.test(scriptPath)) {
      let path = dirname(dirname(scriptPath));
      if (path[path.length - 1] !== '/') {
        path += '/';
      }
      return path;
    }
  }

  return '/';
}

/**
 * Load a text resource
 */
export async function loadText(path: string): Promise<any> {
  const response = await request(path);
  if (!response.ok) {
    throw new Error('Request failed: ' + response.status);
  }

  return response.text();
}
