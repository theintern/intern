import chalk from 'chalk';
import {
  cp,
  echo,
  exec as shellExec,
  mkdir,
  sed,
  test,
  ExecOptions,
  ExecOutputReturnValue
} from 'shelljs';
import { sync as glob, IOptions } from 'glob';
import { basename, dirname, join, relative, resolve } from 'path';
import { spawnSync } from 'child_process';

export interface ExecReturnValue extends ExecOutputReturnValue {
  stdout: string;
  stderr: string;
}

// This script assumes CWD is the project root, which will be the case if the
// dev scripts are running via NPM

export const baseDir = dirname(dirname(__dirname));

export interface FilePattern {
  base: string;
  pattern: string;
}

/**
 * Copy the files denoted by an array of glob patterns into a given directory.
 */
export function copyAll(patterns: (string | FilePattern)[], outDir: string) {
  for (const pattern of patterns) {
    let filePattern: string;
    const options: IOptions = {};

    if (typeof pattern !== 'string') {
      options.cwd = pattern.base;
      filePattern = pattern.pattern;
    } else {
      options.cwd = '.';
      filePattern = pattern;
    }

    for (const filename of glob(filePattern, options)) {
      copy(filename, outDir, options.cwd);
    }
  }
}

/**
 * Copy a file or directory to a directory
 */
export function copy(fileOrDir: string, outDir: string, cwd = '.') {
  log(`Copying ${join(cwd, fileOrDir)} to ${relative('.', outDir)}`);
  const dst = join(outDir, fileOrDir);
  const dstDir = dirname(dst);
  if (!test('-d', dstDir)) {
    mkdir('-p', dstDir);
  }
  cp('-r', join(cwd, fileOrDir), dst);
}

/**
 * Synchronously run a command. Exit if the command fails. Otherwise return an
 * object:
 *
 *   {
 *     code: exit code
 *     stdout: content of stdout stream
 *     stderr: content of stderr stream
 *   }
 */
export function exec(command: string, options?: ExecOptions) {
  if (!options) {
    options = {};
  }
  if (options.silent == null) {
    options.silent = true;
  }
  const result = <ExecReturnValue>shellExec(command, options);
  if (result.code) {
    throw new ExecError(command, result.code, result.stdout, result.stderr);
  }
  return result;
}

/**
 * If the project has inline sources in source maps set, set the path to the
 * source file to be a sibling of the compiled file.
 */
export function fixSourceMaps() {
  glob(join(baseDir, '_build', 'src', '**', '*.js.map'), {
    nodir: true
  }).forEach(filename => {
    sed(
      '-i',
      /("sources":\[")(.*?)("\])/,
      `$1${basename(filename, '.js.map')}.ts$3`,
      filename
    );
  });
}

/**
 * Lint a project
 */
export function lint(tsconfigFile: string) {
  // Use the tslint file from this project if the project doesn't have one of
  // its own
  let tslintJson = test('-f', 'tslint.json')
    ? 'tslint.json'
    : resolve(join(__dirname, 'tslint.json'));
  const tslint = require.resolve('tslint/bin/tslint');
  spawnSync('node', [tslint, '-c', tslintJson, '--project', tsconfigFile]);
}

/**
 * Log a message to the console
 */
export function log(message: string) {
  echo(message);
}

/**
 * Log an error to the console
 */
export function logError(message: string) {
  echo(chalk.red(message));
}

export class ExecError extends Error {
  code: number;
  stdout: string;
  stderr: string;

  constructor(command: string, code: number, stdout: string, stderr: string) {
    super(`Command "${command}" failed (${code})`);
    this.name = 'ExecError';
    this.code = code;
    this.stdout = getText(stdout);
    this.stderr = getText(stderr);
  }
}

function getText(text: string) {
  text = text || '';
  return text.replace(/^\s+/, '').replace(/\s+$/, '');
}
