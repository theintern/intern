#!/usr/bin/env node

import { exec, log } from './lib/util';

log('Running tests');
try {
  exec(`ts-node -r tsconfig-paths/register src/bin/intern.ts run`, {
    silent: false
  });
} catch (error) {
  if (error.name === 'ExecError') {
    process.exitCode = 1;
  } else {
    throw error;
  }
}
log('Done testing');
