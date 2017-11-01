import Task from '@dojo/core/async/Task';
import { mixin } from '@dojo/core/lang';

/**
 * Creates a promise that resolves itself after `ms` milliseconds.
 *
 * @param ms Time until resolution in milliseconds.
 */
export function sleep(ms: number): Task<void> {
	let timer: NodeJS.Timer;
	return new Task<void>(
		function(resolve) {
			timer = setTimeout(() => {
				resolve();
			}, ms);
		},
		() => clearTimeout(timer)
	);
}

/**
 * Annotates the method with additional properties that provide guidance to
 * [[Command]] about how the method interacts with stored context elements.
 */
export function forCommand(
	fn: Function,
	properties: { usesElement?: boolean; createsContext?: boolean }
): Function {
	return mixin(fn, properties);
}

/**
 * Converts a function to a string representation suitable for use with the
 * `execute` API endpoint.
 */
export function toExecuteString(fn: Function | string): string {
	if (typeof fn === 'function') {
		// If someone runs code through Istanbul in the test runner, inline
		// functions that are supposed to execute on the client will contain
		// code coverage variables that will cause script execution failure.
		// These statements are very simple and are generated in a consistent
		// manner, so we can get rid of them easily with a regular expression
		fn = fn.toString().replace(/\b__cov_[^,;]+[,;]/g, '');
		fn = 'return (' + fn + ').apply(this, arguments);';
	}

	return fn;
}

/**
 * Removes the first line of a stack trace, which in V8 is the string
 * representation of the object holding the stack trace (which is garbage for
 * captured stack traces).
 */
export function trimStack(stack: string): string {
	return stack.replace(/^[^\n]+/, '');
}
