import Node from '../lib/executors/Node';
import { Config } from '../lib/executors/Executor';
import global from '@dojo/shim/global';

interface TaskOptions extends grunt.task.ITaskOptions, Partial<Config> {
	[key: string]: any;
}

export = function (grunt: IGrunt) {
	grunt.registerMultiTask('intern', function () {
		const done = this.async();
		const config = this.options<TaskOptions>({});

		// Force colored output for istanbul report
		process.env.FORCE_COLOR = 'true';

		const intern = global.intern = new Node(config);
		intern.run().then(finish, finish);

		function finish(error?: any) {
			// Remove the global intern object when we're done; this will allow Intern to be run again in the same
			// process
			global.intern = null;
			done(error);
		}
	});
};
