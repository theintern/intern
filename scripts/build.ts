// Build, and optionally continue watching and rebuilding a project

// Use native tsc, webpack, and stylus watchers.
// Use chokidar to create file watchers to copy changed files.
// When the script is first run, do a complete build. If a 'watch' argument is
// provided, start watchers.

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { baseDir, copy, copyAll, exec, log, logError } from './lib/util';
import { watchProcess, watchFiles } from './lib/watch';

function handleError(error: Error) {
  if (error.name === 'ExecError') {
    logError((<any>error).stderr || (<any>error).stdout);
    process.exit((<any>error).code);
  } else {
    throw error;
  }
}

const args = process.argv.slice(2);
const watchMode = args[0] === 'watch';

// -----------------------------------------------------------------
// Typescript
// -----------------------------------------------------------------
for (const suffix of ['lib', 'bin']) {
  try {
    const tsconfig = `${baseDir}/tsconfig-${suffix}.json`;

    log(`Compiling ${suffix}...`);
    if (watchMode) {
      watchProcess(
        `tsc-${suffix}`,
        `npx tsc -p ${tsconfig} --watch`,
        /\berror TS\d+:/
      );
    } else {
      exec(`npx tsc -p ${tsconfig}`);
    }
  } catch (error) {
    handleError(error);
  }
}

// -----------------------------------------------------------------
// Webpack
// -----------------------------------------------------------------
try {
  log('Running webpack...');
  if (watchMode) {
    watchProcess('webpack', 'npx webpack --watch', /^ERROR\b/);
  } else {
    exec('npx webpack');
  }
} catch (error) {
  handleError(error);
}

// -----------------------------------------------------------------
// Resources
// -----------------------------------------------------------------
log('Copying resources...');
const buildDir = `${baseDir}/_build`;

function copyFiles() {
  copyAll([{ base: 'src', pattern: '**/*.{styl,d.ts,html,js.png}' }], buildDir);
  copy('schemas', buildDir);
  copy('README.md', buildDir);
  copy('LICENSE', buildDir);

  const pkgJson = JSON.parse(
    readFileSync(join(baseDir, 'package.json'), { encoding: 'utf8' })
  );
  delete pkgJson['lint-staged'];
  delete pkgJson['pre-commit'];
  delete pkgJson.prettier;
  delete pkgJson.devDependencies;
  writeFileSync(
    `${buildDir}/package.json`,
    JSON.stringify(pkgJson, null, '  ')
  );
}

copyFiles();

if (watchMode) {
  watchFiles(
    [
      'src/**/*.{styl,d.ts,html,js.png}',
      'schemas/**',
      'README.md',
      'LICENSE',
      'package.json'
    ],
    copyFiles
  );
}

log('Done building');
