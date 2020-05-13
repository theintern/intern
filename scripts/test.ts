import { existsSync } from 'fs';
import { sync as glob } from 'glob';
import { join } from 'path';
import exec from './lib/exec';
import { latestModTime, log, logError } from './lib/util';
import { watchProcess } from './lib/watch';

(async function main() {
  try {
    const testerPath = '_testIntern';
    const browserTestPath = '_tests';
    let watchMode = false;

    const args = process.argv.slice(2);
    while (args.length > 0) {
      const arg = args.shift();
      if (arg === '-w' || arg == '--watch') {
        watchMode = true;
      }
    }

    const tasks = [];

    const latestUnitTestTime = await latestModTime(
      glob(join('tests', 'unit', '**', '*.ts'))
    );
    const latestSrcTime = await latestModTime(
      glob(join('src', '**', '*.{html,ts}'))
    );

    const testerExists = existsSync(testerPath);
    const latestTesterTime = testerExists
      ? await latestModTime(glob(join(testerPath, '**', '*.js')))
      : 0;

    if (!testerExists || watchMode || latestSrcTime > latestTesterTime) {
      log('Building test Intern...');
      const cmd = ['ts-node', 'scripts/build.ts', '-o', testerPath];
      if (watchMode) {
        cmd.push('--watch');
        watchProcess('testIntern', cmd);
      } else {
        const proc = exec(cmd[0], cmd.slice(1), { stdio: 'inherit' });
        tasks.push(proc);
      }
    }

    const browserExists = existsSync(browserTestPath);
    const latestBrowserTime = browserExists
      ? await latestModTime(glob(join(browserTestPath, '**', '*.js')))
      : 0;
    const latestBrowserSrcTime = await latestModTime(
      glob(join('src', 'core', '**', '*.ts'))
    );

    if (
      !browserExists ||
      watchMode ||
      latestBrowserSrcTime > latestBrowserTime ||
      latestUnitTestTime > latestBrowserTime
    ) {
      log('Building browser tests...');
      const cmd = ['npx', 'webpack', '--config', 'webpack-tests.config.ts'];
      if (watchMode) {
        cmd.push('--watch');
        watchProcess('browserTests', cmd);
      } else {
        const proc = exec(cmd[0], cmd.slice(1), { stdio: 'inherit' });
        tasks.push(proc);
      }
    }

    if (!watchMode) {
      await Promise.all(tasks);

      const cmdArgs = [
        '-r',
        'tsconfig-paths/register',
        `${testerPath}/bin/intern.js`
      ];
      cmdArgs.push(...process.argv.slice(2));

      if (process.env.DEBUG) {
        cmdArgs.unshift('--inspect-brk');
      }

      log('Running tests...');
      try {
        const proc = exec('node', cmdArgs, { stdio: 'inherit' });
        await proc;
      } catch (error) {
        if (!error.isCancelled) {
          process.exitCode = 1;
        }
      }
      log('Done testing');
    }
  } catch (error) {
    logError(error);
    if (!error.isCanceled) {
      process.exitCode = 1;
    }
  }
})();
