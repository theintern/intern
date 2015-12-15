import Executor from './lib/executors/Executor';
import { AmdRequire } from './lib/util';
import { InternConfig } from './lib/executors/PreExecutor';
import { getDefault, getModule } from './lib/util';

declare var require: AmdRequire;

/**
 * The arguments Intern was started with, post-processing (e.g.,
 * repeated arguments are converted to arrays).
 */
export var args: { [key: string]: any; };

export var config: InternConfig;

/**
 * The executor for the current test run.
 */
export var executor: Executor;

/**
 * AMD plugin API interface for easy loading of test interfaces.
 */
// TODO: Preload interface modules into non-AMD loaders.
export function load<T>(id: string, parentRequire: AmdRequire, callback: (value: T) => void) {
	// For the Node.js loader, this function must resolve synchronously
	if (require.length === 1) {
		callback(getDefault(require('./lib/interfaces/' + id)));
	}
	else {
		getModule('./lib/interfaces/' + id, require).then(callback);
	}
}

export function normalize(interfaceId: string) {
	// The loader should not attempt to normalize values passed to the
	// loader plugin as module IDs, since they are not module IDs.
	return interfaceId;
}

/**
 * The planned execution mode. One of 'client', 'runner', or 'custom'.
 */
export var mode: string;
