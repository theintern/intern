import { existsSync } from 'fs';
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

    const latestUnitTestTime = await latestModTime(join('tests', 'unit'));
    const latestSrcTime = await latestModTime('src');

    const testerExists = existsSync(testerPath);
    const latestTesterTime = testerExists ? await latestModTime(testerPath) : 0;

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
    const latestBrowserTime = testerExists
      ? await latestModTime(browserTestPath)
      : 0;

    if (
      !browserExists ||
      watchMode ||
      latestSrcTime > latestBrowserTime ||
      latestUnitTestTime > latestBrowserTime
    ) {
      log('Building browser tests...');
      const cmd = ['npx', 'webpack', '--config', 'webpack-tests.config.ts'];
      if (watchMode) {
        cmd.push('--watch');
        watchProcess('tests', cmd);
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
        `${testerPath}/bin/intern.js`,
        'run'
      ];
      cmdArgs.push(...process.argv.slice(2));

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
