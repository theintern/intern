import { readFile, readdirSync, readFileSync, mkdirSync, existsSync } from 'fs';
import {
  dirname,
  extname,
  isAbsolute,
  join,
  normalize,
  resolve,
  sep
} from 'path';
import { parse } from 'shell-quote';
import { RawSourceMap } from 'source-map';
import { sync as glob, hasMagic } from 'glob';

import { Task, CancellablePromise } from '../../../common';

import process from './process';
import {
  defaultConfig,
  getBasePath,
  loadConfig,
  parseArgs,
  splitConfigPath
} from '../common/util';

/**
 * Expand a list of glob patterns into a flat file list. Patterns may be simple
 * file paths or glob patterns. Patterns starting with '!' denote exclusions.
 * Note that exclusion rules will not apply to simple paths.
 */
export function expandFiles(patterns?: string[] | string) {
  if (!patterns) {
    patterns = [];
  } else if (!Array.isArray(patterns)) {
    patterns = [patterns];
  }

  const excludes: string[] = [];
  const includes: string[] = [];
  const paths: string[] = [];

  for (let pattern of patterns) {
    if (pattern[0] === '!') {
      excludes.push(pattern.slice(1));
    } else {
      if (hasMagic(pattern)) {
        includes.push(pattern);
      } else {
        paths.push(pattern);
      }
    }
  }

  const allPaths = includes
    .map(pattern => glob(pattern, { ignore: excludes }))
    .reduce((allFiles, files) => allFiles.concat(files), paths);
  const uniquePaths: { [name: string]: boolean } = {};
  allPaths.forEach(path => (uniquePaths[path] = true));

  return Object.keys(uniquePaths);
}

/**
 * Get the user-supplied config data, which may include command line args and a
 * config file.
 *
 * @param file A config file
 * @param argv An array of command line arguments. This should follow the same
 * format as process.argv (where user args start at index 2).
 */
export function getConfig(
  file?: string
): CancellablePromise<{ config: any; file?: string }>;
export function getConfig(
  argv?: string[]
): CancellablePromise<{ config: any; file?: string }>;
export function getConfig(
  file: string,
  argv?: string[]
): CancellablePromise<{ config: any; file?: string }>;
export function getConfig(
  fileOrArgv?: string | string[],
  argv?: string[]
): CancellablePromise<{ config: any; file?: string }> {
  let args: { [key: string]: any } = {};
  let file = typeof fileOrArgv === 'string' ? fileOrArgv : undefined;
  argv = Array.isArray(fileOrArgv) ? fileOrArgv : argv;
  const userArgs = (argv || process.argv).slice(2);

  if (process.env['INTERN_ARGS']) {
    Object.assign(
      args,
      parseArgs(parse(process.env['INTERN_ARGS'] || '') as string[])
    );
  }

  if (userArgs.length > 0) {
    Object.assign(args, parseArgs(userArgs));
  }

  if (file) {
    args.config = file;
  }

  let load: CancellablePromise<{ [key: string]: any }>;

  if (args.config) {
    // If a config parameter was provided, load it and mix in any other
    // command line args.
    const { configFile, childConfig } = splitConfigPath(args.config, sep);
    file = resolve(configFile || defaultConfig);
    load = loadConfig(file, loadText, args, childConfig);
  } else {
    // If no config parameter was provided, try 'intern.json', or just
    // resolve to the original args
    file = resolve(defaultConfig);
    load = loadConfig(file, loadText, args, undefined).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') {
          file = undefined;
          return args;
        }
        throw error;
      }
    );
  }

  return load
    .then(config => {
      // If a basePath wasn't set in the config or via a query arg, and we
      // have a config file path, use that.
      if (file) {
        config.basePath = getBasePath(file, config.basePath, isAbsolute, sep);
      }
      return config;
    })
    .then(config => ({ config, file }));
}

/**
 * Return the absolute path to Intern's package
 */
export function getPackagePath(dir = __dirname): string {
  if (dirname(dir) === dir) {
    throw new Error("Couldn't find package.json");
  }
  if (readdirSync(dir).includes('package.json')) {
    return dir;
  }
  return getPackagePath(dirname(dir));
}

/**
 * Loads a text resource.
 */
export function loadText(path: string): CancellablePromise<string> {
  return new Task<string>((resolve, reject) => {
    readFile(path, { encoding: 'utf8' }, (error, data) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
}

// TODO: Remove in the next version
/**
 * Normalize a path (e.g., resolve '..')
 */
export function normalizePath(path: string) {
  return normalize(path).replace(/\\/g, '/');
}

/**
 * Given a source filename, and optionally code, return the file's source map if
 * one exists.
 */
export function readSourceMap(
  sourceFile: string,
  code?: string
): RawSourceMap | undefined {
  if (!code) {
    code = readFileSync(sourceFile, { encoding: 'utf8' });
  }

  let match: RegExpMatchArray | null;

  // sourceMappingUrl must be on last line of source file; search for last
  // newline from code.length - 2 in case the file ends with a newline
  const lastNewline = code.lastIndexOf('\n', code.length - 2);
  const lastLine = code.slice(lastNewline + 1);

  if ((match = sourceMapRegEx.exec(lastLine))) {
    if (match[1]) {
      return JSON.parse(Buffer.from(match[2], 'base64').toString('utf8'));
    } else {
      // Treat map file path as relative to the source file
      const mapFile = join(dirname(sourceFile), match[2]);
      return JSON.parse(readFileSync(mapFile, { encoding: 'utf8' }));
    }
  }
}

/**
 * Indicate whether a value is an ErrnoException
 */
export function isErrnoException(value: any): value is NodeJS.ErrnoException {
  return value.errno !== null;
}

/**
 * Recursively create directories
 */
export function mkdirp(dir: string) {
  const parent = dirname(dir);
  if (parent && !existsSync(parent)) {
    mkdirp(parent);
  }
  if (!existsSync(dir)) {
    mkdirSync(dir);
  }
}

export function transpileSource(filename: string, code: string) {
  require.extensions[extname(filename)](
    {
      _compile(source: string) {
        code = source;
      }
    } as any,
    filename
  );

  return code;
}

// Regex for matching sourceMappingUrl comments
const sourceMapRegEx = /^(?:\/{2}[#@]{1,2}|\/\*)\s+sourceMappingURL\s*=\s*(data:(?:[^;]+;)+base64,)?(\S+)/;
