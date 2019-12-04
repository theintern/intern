import { exec, ChildProcessWithoutNullStreams } from 'child_process';
import { watch, FSWatcher } from 'chokidar';
import { log, logError } from './util';

function logProcessOutput(
  name: string,
  text: string | Buffer,
  errorTest?: RegExp
) {
  if (!text) {
    return;
  }

  if (typeof text !== 'string') {
    text = text.toString('utf8');
  }
  let lines = text
    .split('\n')
    .filter(line => !/^\s*$/.test(line))
    .filter(line => !/^Child$/.test(line))
    .map(line => line.replace(/\s+$/, ''))
    // Strip off timestamps
    .map(line =>
      /^\d\d:\d\d:\d\d \w\w -/.test(line)
        ? line.slice(line.indexOf('-') + 2)
        : line
    );
  if (errorTest) {
    lines.forEach(line => {
      if (errorTest.test(line)) {
        logError(`[${name}] ${line}`);
      } else {
        log(`[${name}] ${line}`);
      }
    });
  } else {
    lines.forEach(line => log(`[${name}] ${line}`));
  }
}

/**
 * Return a file watcher that will copy changed files to an output dir
 */
export function watchFiles(
  patterns: string[],
  copyFiles: () => void
): FSWatcher {
  const watcher = watch(patterns)
    .on('ready', () => {
      log(`Watching files for ${patterns[0]}`);
      watcher.on('add', copyFiles);
      watcher.on('change', copyFiles);
      watcher.on('unlink', file => log(`Source file ${file} removed`));
    })
    .on('error', (error: Error) => {
      logError(`Watcher error: ${error.stack}`);
    });

  return watcher;
}

/**
 * Execute a process in the background
 */
export function watchProcess(
  name: string,
  command: string,
  errorTest?: RegExp
) {
  const proc = exec(command) as ChildProcessWithoutNullStreams;
  proc.stdout.on('data', (data: Buffer) => {
    logProcessOutput(name, data.toString('utf8'), errorTest);
  });
  proc.stderr.on('data', (data: Buffer) => {
    logProcessOutput(name, data.toString('utf8'), errorTest);
  });
  proc.on('error', () => {
    process.exit(1);
  });
}
