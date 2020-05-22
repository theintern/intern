import { readFile } from 'fs';
import { dirname, isAbsolute, resolve, sep } from 'path';
import {
  ConfiguratorOptions,
  createConfigurator as configCreateConfigurator
} from '../config';
import { getDefaultBasePath } from './util';

/**
 * The configurator singleton that should be used to load and manage Config
 * objects
 */
export function createConfigurator(options?: Partial<ConfiguratorOptions>) {
  return configCreateConfigurator({
    loadText,
    resolvePath,
    dirname,
    isAbsolute,
    defaultBasePath: getDefaultBasePath(),
    sep,
    ...options
  });
}

/**
 * Loads a text resource.
 */
function loadText(path: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    readFile(path, { encoding: 'utf8' }, (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
}

/**
 * Resolve a file path, optionally against a base path
 */
function resolvePath(file: string, base?: string) {
  if (base) {
    return resolve(base, file);
  }
  return resolve(file);
}
