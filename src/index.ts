import Executor from './lib/executors/Node';
import _intern from './intern';

declare global {
	// There will be one active executor
	export const intern: Executor;
}

export default Executor;

export { _intern as intern };
