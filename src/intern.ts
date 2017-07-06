import Executor from './lib/executors/Executor';
import global from '@dojo/shim/global';

export default function intern(): Executor {
	return global.intern;
}
