import { existsSync } from 'fs';
import exec from './lib/exec';
import { log } from './lib/util';

(async function main() {
  const testerPath = '_testIntern';
  const browserTestPath = '_tests';

  const cmdArgs = [
    '-r',
    'tsconfig-paths/register',
    `${testerPath}/bin/intern.js`,
    'run'
  ];
  cmdArgs.push(...process.argv.slice(2));

  const tasks = [];

  if (!existsSync(testerPath)) {
    log('Building test Intern...');
    const proc = exec('ts-node', ['scripts/build.ts', '-o', testerPath]);
    proc.all!.pipe(process.stdout);
    tasks.push(proc);
  }

  if (!existsSync(browserTestPath)) {
    log('Building browser tests...');
    const proc = exec('npx', [
      'webpack',
      '--config',
      'webpack-tests.config.ts'
    ]);
    tasks.push(proc);
  }

  await Promise.all(tasks);

  log('Running tests...');
  try {
    const proc = exec('node', cmdArgs);
    proc.all!.pipe(process.stdout);
    await proc;
  } catch (error) {
    if (!error.isCancelled) {
      process.exitCode = 1;
    }
  }
  log('Done testing');
})();
