import { createHandle } from '@dojo/core/lang';
import { Handle } from '@dojo/interfaces/core';
import { mkdirSync, statSync, writeFile as fsWriteFile } from 'fs';
import { dirname } from 'path';
import Promise from '@dojo/shim/Promise';

/**
 * Attaches an event to a Node.js EventEmitter and returns a handle for removing the listener later.
 *
 * @param emitter A Node.js EventEmitter object.
 * @param event The name of the event to listen for.
 * @param listener The event listener that will be invoked when the event occurs.
 * @returns A remove handle.
 */
export function on(emitter: NodeJS.EventEmitter, event: string | symbol, listener: Function): Handle {
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
	}
	catch (error) {
		return false;
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
	return new Promise<void>(function (resolve, reject) {
		function mkdirp(dir: string) {
			if (!dir) {
				return;
			}

			try {
				mkdirSync(dir);
			}
			catch (error) {
				// A parent directory didn't exist, create it
				if (error.code === 'ENOENT') {
					mkdirp(dirname(dir));
					mkdirp(dir);
				}
				else {
					if (!statSync(dir).isDirectory()) {
						throw error;
					}
				}
			}
		}

		mkdirp(dirname(filename));
		fsWriteFile(filename, data, function (error) {
			if (error) {
				reject(error);
			}
			else {
				resolve();
			}
		});
	});
}
