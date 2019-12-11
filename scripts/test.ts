#!/usr/bin/env node

import { exec, log } from './lib/util';

const args = process.argv.slice(2).join(' ');
let command = 'ts-node -r tsconfig-paths/register src/bin/intern.ts run';
if (args) {
  command += ` ${args}`;
}

log('Running tests');
log(command);
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
