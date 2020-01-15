// Build, and optionally continue watching and rebuilding a project

// Use native tsc, webpack, and stylus watchers.
// Use chokidar to create file watchers to copy changed files.
// When the script is first run, do a complete build. If a 'watch' argument is
// provided, start watchers.

import { readFileSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import exec from './lib/exec';
import { baseDir, copy, copyAll, log, logError } from './lib/util';
import { watchFiles, watchProcess } from './lib/watch';

(async () => {
  function handleError(error: Error) {
    if (error.name === 'ExecError') {
      logError((<any>error).stderr || (<any>error).stdout);
      process.exit((<any>error).code);
    } else {
      throw error;
    }
  }

  let watchMode = false;
  let outDirOpt: string | undefined;
  let pack = false;

  const args = process.argv.slice(2);
  while (args.length > 0) {
    const arg = args.shift();
    if (arg === '-w' || arg == '--watch') {
      watchMode = true;
    } else if (arg == '--outdir' || arg == '-o') {
      outDirOpt = args.shift();
      if (!outDirOpt) {
        throw new Error('-o / --outdir needs an output directory');
      }
    } else if (arg === '--pack' || arg === '-p') {
      pack = true;
    }
  }

  const outDir = outDirOpt;

  // -----------------------------------------------------------------
  // Typescript
  // -----------------------------------------------------------------
  for (const suffix of ['bin', 'lib']) {
    try {
      const tsconfig = `${baseDir}/tsconfig-${suffix}.json`;
      const cmd = ['npx', 'tsc', '-p', tsconfig];

      if (outDir != null) {
        cmd.push('--outDir', outDir);
      }

      log(`Compiling ${suffix}...`);
      if (watchMode) {
        cmd.push('--watch');
        watchProcess(`tsc-${suffix}`, cmd, /\berror TS\d+:/);
      } else {
        await exec(cmd[0], cmd.slice(1));
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
    const cmd = ['npx', 'webpack'];

    if (outDir) {
      const webpackOut = resolve(process.cwd(), outDir);
      cmd.push('--output-path', join(webpackOut, 'browser'));
    }

    if (watchMode) {
      cmd.push('--watch');
      watchProcess('webpack', cmd, /^ERROR\b/);
    } else {
      await exec(cmd[0], cmd.slice(1));
    }
  } catch (error) {
    handleError(error);
  }

  // -----------------------------------------------------------------
  // Resources
  // -----------------------------------------------------------------
  log('Copying resources...');
  const buildDir = join(baseDir, outDir || '_build');

  function copyFiles() {
    copyAll([{ base: 'src', pattern: '**/*.{d.ts,js.png}' }], buildDir);
    copy('schemas', buildDir);
    copy('README.md', buildDir);
    copy('LICENSE', buildDir);
    copy('index.html', buildDir, 'src');
    copy('favicon.png', buildDir, 'src');
    copy(
      'remote.html',
      join(buildDir, 'browser'),
      join('src', 'core', 'browser')
    );

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

  // -----------------------------------------------------------------
  // Packaging
  // -----------------------------------------------------------------
  if (pack) {
    log('Creating package tarball...');
    await exec('npm', ['pack', buildDir]);
  }

  log('Done building Intern');
})();
