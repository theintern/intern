import { IRequire } from 'dojo/loader';
import Executor from './lib/executors/Executor';
import { CommandLineArguments, Config } from './common';

declare const require: IRequire;

/**
 * The arguments Intern was started with, post-processing (e.g.,
 * repeated arguments are converted to arrays).
 */
export let args: CommandLineArguments;

export function setArgs(value: CommandLineArguments) {
	args = value;
}

/**
 * The current Intern configuration.
 */
export let config: Config;

export function setConfig(value?: Config) {
	config = value;
}

/**
 * The executor for the current test run.
 */
export let executor: Executor = null;

export function setExecutor(ex?: Executor): void {
	executor = ex;
}

/**
 * AMD plugin API interface for easy loading of test interfaces.
 */
export function load(id: string, _pluginRequire: IRequire, callback: (module: string) => void) {
	require([ './lib/interfaces/' + id ], function (iface) {
		// Return the default export since an AMD consumer will expect that
		callback(iface.default);
	});
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

export function setMode(value: ExecutionMode) {
	mode = value;
}

export type ExecutionMode = 'client' | 'runner' | 'custom';
