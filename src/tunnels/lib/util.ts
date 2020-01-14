import { createHandle, Handle } from '../../common';
import { mkdirSync, statSync, writeFile as fsWriteFile } from 'fs';
import { dirname } from 'path';
import { execSync } from 'child_process';

/**
 * Attaches an event to a Node.js EventEmitter and returns a handle for removing
 * the listener later.
 *
 * @param emitter A Node.js EventEmitter object.
 * @param event The name of the event to listen for.
 * @param listener The event listener that will be invoked when the event
 * occurs.
 * @returns A remove handle.
 */
export function on(
  emitter: NodeJS.EventEmitter,
  event: string | symbol,
  listener: (...args: any[]) => void
): Handle {
  emitter.on(event, listener);
  return createHandle(() => emitter.removeListener(event, listener));
}

/**
 * Returns true if a file or directory exists
 *
 * @param filename
 * @returns true if filename exists, false otherwise
 */
export function fileExists(filename: string): boolean {
  try {
    statSync(filename);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Kill a process and its immediate children
 *
 * This function will attempt to kill all processes that it should, and will
 * report an error at the end if any process could not be killed.
 */
export function kill(pid: number) {
  let error: Error | undefined;

  getChildProcesses(pid).forEach(childPid => {
    try {
      killProcess(childPid);
    } catch (err) {
      error = err;
    }
  });

  try {
    killProcess(pid);
  } catch (err) {
    error = err;
  }

  if (error) {
    throw new Error(
      `Failed to kill ${pid} or one of its children: ${error.message}`
    );
  }
}

function killProcess(pid: number) {
  try {
    process.kill(pid);
  } catch (error) {
    // Ignore the error if the process couldn't be found since that means
    // it's already dead
    if (error.code !== 'ESRCH') {
      throw error;
    }
  }
}

/**
 * Writes data to a file.
 *
 * The file's parent directories will be created if they do not already exist.
 *
 * @param data
 * @param filename
 * @returns A Promise that resolves when the file has been written
 */
export function writeFile(data: any, filename: string) {
  return new Promise<void>(function(resolve, reject) {
    function mkdirp(dir: string) {
      if (!dir) {
        return;
      }

      try {
        mkdirSync(dir);
      } catch (error) {
        // A parent directory didn't exist, create it
        if (error.code === 'ENOENT') {
          mkdirp(dirname(dir));
          mkdirp(dir);
        } else {
          if (!statSync(dir).isDirectory()) {
            throw error;
          }
        }
      }
    }

    mkdirp(dirname(filename));
    fsWriteFile(filename, data, function(error) {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Get the children of a process
 */
function getChildProcesses(pid: number) {
  const command =
    process.platform === 'win32'
      ? 'wmic PROCESS GET ParentProcessId,ProcessId'
      : 'ps -A -o ppid,pid';

  return execSync(command, { encoding: 'utf8' })
    .trim()
    .split('\n')
    .slice(1)
    .map(line => line.trim())
    .map(line => line.split(/\s+/).map(word => word.trim()))
    .map(words => ({ parent: Number(words[0]), child: Number(words[1]) }))
    .filter(entry => entry.parent === pid)
    .map(entry => entry.child);
}
