import { lint, log, logError } from './lib/util';

log('Linting...');

try {
  lint('../tsconfig.json');
} catch (error) {
  if (error.name === 'ExecError') {
    logError(error.stdout);
    process.exitCode = error.code;
  } else {
    throw error;
  }
}

log('Done linting');
