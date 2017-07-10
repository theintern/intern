import NodeExecutor from './lib/executors/Node';
import global from '@dojo/shim/global';

const intern = global.intern = new NodeExecutor();
export default intern;

declare global {
	export const intern: NodeExecutor;
}
