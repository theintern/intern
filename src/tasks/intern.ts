import global from '@dojo/shim/global';
import { assign } from '@dojo/core/lang';

import Node from '../lib/executors/Node';
import { Config } from '../lib/executors/Executor';
import { getConfig } from '../lib/node/util';

interface TaskOptions extends grunt.task.ITaskOptions, Partial<Config> {
	[key: string]: any;
}

function configure(options: TaskOptions): Promise<{
	config: Partial<Config>;
	options: TaskOptions;
}> {
	if (options.config) {
		return getConfig(options.config, []).then(({ config }) => {
			delete options.config;

			return { config, options };
		});
	}

	return Promise.resolve({ config: {}, options });
}

export = function(grunt: IGrunt) {
	grunt.registerMultiTask('intern', function() {
		const done = this.async();
		const options = assign({}, this.options<TaskOptions>({}));

		// Force colored output for istanbul report
		process.env.FORCE_COLOR = 'true';

		configure(options).then(({ config, options }) => {
			const intern = (global.intern = new Node());
			intern.configure(config);
			intern.configure(options);

			return intern.run();
		}).then(finish, finish);

		function finish(error?: any) {
			global.intern = null;
			done(error);
		}
	});
};
