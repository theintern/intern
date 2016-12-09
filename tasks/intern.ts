/// <reference types="grunt"/>

interface TaskOptions extends grunt.task.ITaskOptions {
	cwd?: string;
	nodeOptions?: any;
	runType?: string;
	[key: string]: any;
}

interface SpawnedChild extends grunt.util.ISpawnedChild {
	stdout?: NodeJS.EventEmitter;
	stderr?: NodeJS.EventEmitter;
}

function internTask(grunt: IGrunt) {
	function logOutput(line: string) {
		let state: keyof grunt.log.CommonLogging<any> = 'write';

		if (/(\d+)\/(\d+) tests (pass|fail)/.test(line)) {
			const match = /(\d+)\/(\d+) tests (pass|fail)/.exec(line);
			const count = Number(match[1]);
			const total = Number(match[2]);

			if (match[3] === 'pass') {
				state = (count === total) ? 'ok' : 'error';
			}
			else {
				state = count ? 'error' : 'ok';
			}
		}
		else if (/\bPASS/.test(line)) {
			state = 'ok';
		}
		else if (/\bFAIL/.test(line)) {
			state = 'error';
		}

		state === 'error' && grunt.event.emit('intern.fail', line);
		state === 'ok' && grunt.event.emit('intern.pass', line);

		grunt.log[state](line);
	}

	function readOutput(data: any) {
		data = String(data);

		let start = 0;
		let next = data.indexOf('\n', start);

		while (next !== -1) {
			logOutput(data.substring(start, next) + '\n');
			start = next + 1;
			next = data.indexOf('\n', start);
		}

		logOutput(data.slice(start));
	}

	function serialize(data: any) {
		if (typeof data === 'object') {
			return JSON.stringify(data);
		}

		return data;
	}

	grunt.registerMultiTask('intern', function (this: grunt.task.ITask) {
		const done = this.async();
		const opts = <TaskOptions> this.options({ runType: 'client' });
		const args = [ require('path').join(__dirname, '..', opts.runType + '.js') ];
		const env = Object.create(process.env);
		const skipOptions: { [key: string]: boolean } = {
			browserstackAccessKey: true,
			browserstackUsername: true,
			cbtApikey: true,
			cbtUsername: true,
			runType: true,
			sauceAccessKey: true,
			sauceUsername: true,
			testingbotKey: true,
			testingbotSecret: true,
			nodeEnv: true,
			cwd: true,
			// --harmony, etc.
			nodeOptions: true
		};

		if (opts.nodeOptions) {
			// Node Options need to go at the beginning
			if (Array.isArray(opts.nodeOptions)) {
				Array.prototype.unshift.apply(args, opts.nodeOptions);
			}
			else {
				args.unshift(opts.nodeOptions);
			}
		}

		Object.keys(opts).forEach(function (option) {
			if (skipOptions[option]) {
				return;
			}

			const value = opts[option];

			if (Array.isArray(value)) {
				(<any> grunt.util)._.flatten(value).forEach(function (value: any) {
					args.push(option + '=' + serialize(value));
				});
			}
			else if (typeof value === 'boolean') {
				if (value) {
					args.push(option);
				}
			}
			else {
				args.push(option + '=' + serialize(value));
			}
		});

		[
			'browserstackAccessKey',
			'browserstackUsername',
			'cbtApikey',
			'cbtUsername',
			'sauceAccessKey',
			'sauceUsername',
			'testingbotKey',
			'testingbotSecret',
			'nodeEnv'
		].forEach(function (option) {
			const value = opts[option];
			if (value) {
				env[option.replace(/[A-Z]/g, '_$&').toUpperCase()] = value;
			}
		});

		// force colored output for istanbul report
		env.FORCE_COLOR = true;

		const child: SpawnedChild = grunt.util.spawn({
			cmd: process.argv[0],
			args: args,
			opts: {
				cwd: opts.cwd || process.cwd(),
				env: env
			}
		}, function (error: Error) {
			// The error object from grunt.util.spawn contains information
			// that we already logged, so hide it from the user
			done(error ? new Error('Test failure; check output above for details.') : null);
		});

		child.stdout.on('data', readOutput);
		child.stderr.on('data', readOutput);
	});
}

export = internTask;
