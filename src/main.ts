import { IRequire } from 'dojo/loader';
import { Executor } from './lib/executors/Executor';
import { CommandLineArguments, Config } from './interfaces';

declare const require: IRequire;

/**
 * The arguments Intern was started with, post-processing (e.g.,
 * repeated arguments are converted to arrays).
 */
export let args: CommandLineArguments;

/**
 * The current Intern configuration.
 */
export let config: Config;

/**
 * The executor for the current test run.
 */
export let executor: Executor = null;

/**
 * AMD plugin API interface for easy loading of test interfaces.
 */
export function load(id: string, pluginRequire: IRequire, callback: (module: string) => void) {
	require([ './lib/interfaces/' + id ], callback);
}

export function normalize(interfaceId: string) {
	// The loader should not attempt to normalize values passed to the
	// loader plugin as module IDs, since they are not module IDs.
	return interfaceId;
}

/**
 * The planned execution mode. One of 'client', 'runner', or 'custom'.
 */
export let mode: ExecutionMode = null;

export type ExecutionMode = 'client' | 'runner' | 'custom';

export function setExecutor(ex?: Executor): void {
	executor = ex;
}
