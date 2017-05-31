import Node from '../executors/Node';
import Task from '@dojo/core/async/Task';

export default function run(rawConfig: any) {
	return new Task<void>((resolve, reject) => {
		const intern = Node.initialize(rawConfig);
		intern.run().then(resolve, reject);
	});
}
