import pollUntil, { Poller } from './pollUntil';
import * as util from '../lib/util';
import Task from '@dojo/core/async/Task';

export default function pollUntilTruthy<T>(
	poller: Poller | string,
	args?: any[],
	timeout?: number,
	pollInterval?: number
): () => Task<T>;

export default function pollUntilTruthy<T>(
	poller: Poller | string,
	timeout?: number,
	pollInterval?: number
): () => Task<T>;

export default function pollUntilTruthy<T>(
	poller: Poller | string,
	argsOrTimeout?: any[] | number,
	timeout?: number,
	pollInterval?: number
): () => Task<T> {
	const args: any[] = [];

	if (typeof argsOrTimeout === 'number') {
		pollInterval = timeout;
		timeout = argsOrTimeout;
	} else if (argsOrTimeout) {
		args.push(...argsOrTimeout);
	}

	args.unshift(util.toExecuteString(poller));

	const _poller = /* istanbul ignore next */ <Poller>function(
		poller: string
	) {
		const args: any[] = Array.prototype.slice.apply(arguments).slice(1);
		const result = new Function(poller).apply(null, args);
		// If result is truthy, return it. Otherwise return `undefined`, which
		// will cause pollUntil to continue polling.
		return result ? result : undefined;
	};

	return pollUntil(_poller, args, timeout, pollInterval);
}
