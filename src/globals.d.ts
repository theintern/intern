import Executor from './lib/executors/Executor';

declare global {
	// There will be one active executor
	export const intern: Executor;
}
