/**
 * Generate API doc data for a project
 */

import { CliApplication } from 'typedoc';
import { isAbsolute, resolve, relative } from 'path';
import { readFileSync, writeFileSync } from 'fs';

class TypeDocApp extends CliApplication {
  // TypeDoc's input file expansion code will break projects that include JSON
  // files. It also appears to be redundant when the tsconfig.json file already
  // includes all the project files (which it has to do for composite projects).
  // See https://github.com/TypeStrong/typedoc/issues/1323
  expandInputFiles(inputFiles: string[]) {
    return inputFiles;
  }
}

const docFile = resolve('docs', 'api.json');
const cwd = process.cwd();
const args = process.argv.slice(2);
let verbose = false;

// Clear out any command line arguments so they won't be processed by
// CliApplication
process.argv = process.argv.slice(0, 2);

if (args[0] === '-v' || args[0] === '--verbose') {
  verbose = true;
  // Allow -v to be passed to CliApplication
  process.argv.push('-v');
}

print('Generating API data...');
const options = {
  excludePrivate: true,
  json: docFile,
  logger: 'none'
};

if (verbose) {
  options.logger = 'console';
  print(`Running in ${cwd}`);
}

const app = new TypeDocApp();
app.bootstrap(options);

const projectData = readFileSync(docFile, { encoding: 'utf8' });
const project = JSON.parse(projectData);

scrubPaths(project);
normalizeLineEndings(project);

writeFileSync(docFile, JSON.stringify(project, replacer, '\t'));
print(`Wrote API data to ${relative(cwd, docFile)}`);

/**
 * Recursively walk an object, normalizing any line endings in strings
 */
function normalizeLineEndings(reflection: any) {
  walk(
    reflection,
    '__lenormalized__',
    (_, value) => typeof value === 'string' && /\r\n/.test(value),
    value => value.replace(/\r\n/g, '\n')
  );
}

function print(message: string) {
  console.log(`>>> ${message}`);
}

/**
 * Recursively walk an object, relativizing any paths
 */
function scrubPaths(reflection: any) {
  walk(
    reflection,
    '__scrubbed__',
    (key, value) =>
      typeof value === 'string' &&
      (key === 'originalName' || key === 'fileName' || key === 'name'),
    scrubPath
  );
}

/**
 * Relativize a path, or return the input if it's not an absolute path
 */
function scrubPath(value: string) {
  if (/".*"/.test(value)) {
    const testValue = value.replace(/^"/, '').replace(/"$/, '');
    if (isAbsolute(testValue)) {
      const newPath = `"${relative(cwd, testValue)}"`;
      return newPath.replace(/\\/g, '/');
    }
  } else if (isAbsolute(value)) {
    const newPath = relative(cwd, value);
    return newPath.replace(/\\/g, '/');
  }
  return value;
}

function replacer(key: string, value: unknown) {
  if (key === '__scrubbed__' || key === '__lenormalized__') {
    return undefined;
  }
  return value;
}

/**
 * Walk a project reflection, modifying values as necessary
 */
function walk(
  reflection: any,
  sentinel: string,
  test: (key: string, value: any) => boolean,
  modify: (value: any) => any
) {
  if (reflection[sentinel]) {
    return;
  }

  reflection[sentinel] = true;

  if (Array.isArray(reflection)) {
    for (const item of reflection) {
      if (typeof item === 'object') {
        walk(item, sentinel, test, modify);
      }
    }
  } else if (typeof reflection === 'object') {
    const keys = Object.keys(reflection);
    for (const key of keys) {
      const value = reflection[key];
      if (value == null) {
        continue;
      }

      if (test(key, value)) {
        reflection[key] = modify(value);
      } else if (typeof value === 'object') {
        walk(value, sentinel, test, modify);
      }
    }
  }
}
