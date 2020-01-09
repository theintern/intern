import { existsSync } from 'fs';
import { join } from 'path';
import { exec, log } from './lib/util';
import { quote } from 'shell-quote';

const testerPath = join('.', '_testIntern');
const browserTestPath = join('.', '_tests');

const args = quote(process.argv.slice(2));
let command = `node -r tsconfig-paths/register ${testerPath}/bin/intern.js run`;
if (args) {
  command += ` ${args}`;
}

if (!existsSync(testerPath)) {
  log('Building test Intern...');
  exec(`ts-node scripts/build.ts -o ${testerPath}`, { silent: false });
}

if (!existsSync(browserTestPath)) {
  log('Building browser tests...');
  exec('npx webpack --config webpack-tests.config.ts');
}

log('Running tests...');
try {
  exec(command, { silent: false });
} catch (error) {
  if (error.name === 'ExecError') {
    process.exitCode = 1;
  } else {
    throw error;
  }
}
log('Done testing');
