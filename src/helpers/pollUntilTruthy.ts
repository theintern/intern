import pollUntil, {
	Poller,
	Poller1,
	Poller2,
	Poller3,
	Poller4,
	Poller5
} from './pollUntil';
import { toExecuteString } from '../lib/util';
import Task from '@dojo/core/async/Task';

export default function pollUntilTruthy<T>(
	poller: Poller | string,
	timeout?: number,
	pollInterval?: number
): () => Task<T>;

export default function pollUntilTruthy<T>(
	poller: string,
	args?: any[],
	timeout?: number,
	pollInterval?: number
): () => Task<T>;

export default function pollUntilTruthy<T>(
	poller: Poller,
	args?: never[],
	timeout?: number,
	pollInterval?: number
): () => Task<T>;

export default function pollUntilTruthy<T, U>(
	poller: Poller1<U>,
	args?: [U],
	timeout?: number,
	pollInterval?: number
): () => Task<T>;

export default function pollUntilTruthy<T, U, V>(
	poller: Poller2<U, V>,
	args?: [U, V],
	timeout?: number,
	pollInterval?: number
): () => Task<T>;

export default function pollUntilTruthy<T, U, V, W>(
	poller: Poller3<U, V, W>,
	args?: [U, V, W],
	timeout?: number,
	pollInterval?: number
): () => Task<T>;

export default function pollUntilTruthy<T, U, V, W, X>(
	poller: Poller4<U, V, W, X>,
	args?: [U, V, W, X],
	timeout?: number,
	pollInterval?: number
): () => Task<T>;

export default function pollUntilTruthy<T, U, V, W, X, Y>(
	poller: Poller5<U, V, W, X, Y>,
	args?: [U, V, W, X, Y],
	timeout?: number,
	pollInterval?: number
): () => Task<T>;

export default function pollUntilTruthy<T, U, V, W, X, Y>(
	poller:
		| Poller
		| Poller1<U>
		| Poller2<U, V>
		| Poller3<U, V, W>
		| Poller4<U, V, W, X>
		| Poller5<U, V, W, X, Y>
		| string,
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

	args.unshift(toExecuteString(poller));

	const _poller = /* istanbul ignore next */ <Poller>function(
		poller: string
	) {
		const args: any[] = Array.prototype.slice.apply(arguments).slice(1);
		const result = new Function(poller).apply(null, args);
		// If result is truthy, return it. Otherwise return `undefined`, which
		// will cause pollUntil to continue polling.
		return result ? result : undefined;
	};

	return pollUntil(toExecuteString(_poller), args, timeout, pollInterval);
}
