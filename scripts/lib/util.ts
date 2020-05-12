import chalk from 'chalk';
import randomColor from 'randomcolor';
import { ExecaError } from 'execa';
import { stat as fsStat } from 'fs';
import { cp, echo, mkdir, sed, test } from 'shelljs';
import { sync as glob, IOptions } from 'glob';
import { basename, dirname, join } from 'path';
import { promisify } from 'util';

// This script assumes CWD is the project root, which will be the case if the
// dev scripts are running via NPM

export const baseDir = dirname(dirname(__dirname));

const stat = promisify(fsStat);
const colorizedNames: Record<string, string> = {};

export interface FilePattern {
  base: string;
  pattern: string;
}

export function colorizeName(name: string) {
  if (!colorizedNames[name]) {
    colorizedNames[name] = chalk.hex(
      randomColor({ luminosity: 'light', hue: 'blue' })
    )(name);
  }
  return colorizedNames[name];
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
  const dst = join(outDir, fileOrDir);
  const dstDir = dirname(dst);
  if (!test('-d', dstDir)) {
    mkdir('-p', dstDir);
  }
  cp('-r', join(cwd, fileOrDir), dst);
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
 * Return the latest source modification time from a directory
 */
export async function latestModTime(files: string[]): Promise<number> {
  let maxModTime = 0;
  for (const file of files) {
    const stats = await stat(file);
    maxModTime = Math.max(maxModTime, stats.mtimeMs);
  }
  return maxModTime;
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
export function logError(message: string | Error | ExecaError) {
  if (typeof message === 'string') {
    echo(`\n${chalk.red(message)}`);
  } else {
    if (isExecaError(message)) {
      echo(`\n${chalk.red(message.message)}`);
    } else {
      echo(`\n${chalk.red(message.stack!)}`);
    }
  }
}

function isExecaError(error: any): error is ExecaError {
  return error != null && typeof error === 'object' && 'isCanceled' in error;
}
