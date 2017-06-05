import Node from '../executors/Node';
import Task from '@dojo/core/async/Task';
import global from '@dojo/core/global';

export default function run(rawConfig: any) {
	return new Task<void>((resolve, reject) => {
		const intern = global.intern = new Node(rawConfig);
		intern.run().then(resolve, reject);
	});
}
