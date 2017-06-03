import Executor from './lib/executors/Executor';
import global from '@dojo/core/global';

declare global {
	// There will be one active executor
	export const intern: Executor;
}

export default function intern(): Executor {
	return global.intern;
}
