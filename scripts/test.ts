import { exec, log } from './lib/util';
import { quote } from 'shell-quote';

const args = quote(process.argv.slice(2));
let command = 'ts-node -r tsconfig-paths/register src/bin/intern.ts run';
if (args) {
  command += ` ${args}`;
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
