import runner from 'intern/lib/node/runner';
import global from 'dojo-core/global';

interface TaskOptions extends grunt.task.ITaskOptions {
	cwd?: string;
	runType?: string;
	[key: string]: any;
}

export = function (grunt: IGrunt) {
	grunt.registerMultiTask('intern', function () {
		const done = this.async();
		const options = this.options<TaskOptions>({});
		const skipOptions: { [key: string]: boolean } = {
			browserstackAccessKey: true,
			browserstackUsername: true,
			cbtApikey: true,
			cbtUsername: true,
			sauceAccessKey: true,
			sauceUsername: true,
			testingbotKey: true,
			testingbotSecret: true
		};

		[
			'browserstackAccessKey',
			'browserstackUsername',
			'cbtApikey',
			'cbtUsername',
			'sauceAccessKey',
			'sauceUsername',
			'testingbotKey',
			'testingbotSecret'
		].filter(option => Boolean(options[option])).forEach(option => {
			process.env[option.replace(/[A-Z]/g, '_$&').toUpperCase()] = options[option];
		});

		// force colored output for istanbul report
		process.env.FORCE_COLOR = true;

		const config: { [key: string]: any } = {};
		Object.keys(options).filter(option => !skipOptions[option]).forEach(option => {
			config[option] = options[option];
		});

		runner(config).then(finish, finish);

		function finish() {
			global.intern = null;
			done();
		}
	});
};
