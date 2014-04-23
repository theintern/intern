/*jshint node:true */

module.exports = function (grunt) {
	var readBuf = '';

	/**
	 * Log a message to the console
	 */
	function logLine(line) {
		var message;

		try {
			message = JSON.parse(line);

			switch (message.topic) {
				case '/test/pass':
					grunt.log.ok(message.message);
					break;
				case '/test/fail':
					grunt.log.error(message.message);
					break;
				case '/suite/end':
					if (message.suite.numFailedTests === 0) {
						grunt.log.ok(message.message);
					} else {
						grunt.log.error(message.message);
					}
					break;
				case '/session/start':
					grunt.log.write(message.message + '\n');
					break;
				case '/session/end':
					grunt.log.write(message.message + '\n');
					break;
				case '/error':
					grunt.log.error(message.message);
					break;
			}
		}
		catch (e) {
			grunt.log.error('GRUNT: Unexpected Intern message: ', e);
		}
	}

	/**
	 * Read output from a child process's stdout
	 */
	function readOutput(data, flush) {
		var start = 0,
			next;

		readBuf += String(data);
		next = readBuf.indexOf(grunt.util.linefeed, start);

		while (next !== -1) {
			logLine(readBuf.slice(start, next));
			start = next + 1;
			next = readBuf.indexOf(grunt.util.linefeed, start);
		}

		readBuf = readBuf.slice(start);

		if (flush) {
			logLine(readBuf);
			readBuf = '';
		}
	}

	grunt.registerMultiTask('intern', function () {
		var done = this.async(),
			opts = this.options({ runType: 'client' }),
			args = [ require('path').join(__dirname, '..') + '/' + opts.runType + '.js' ],
			env = Object.create(process.env),
			skipOptions = { runType: true, sauceUsername: true, sauceAccessKey: true };

		args.push([ 'reporters=json' ]);

		Object.keys(opts).forEach(function (option) {
			if (skipOptions[option]) {
				return;
			}

			if (Array.isArray(opts[option])) {
				opts[option].forEach(function (value) {
					args.push(option + '=' + value);
				});
			}
			else {
				args.push(option + '=' + opts[option]);
			}
		});

		[ 'sauceUsername', 'sauceAccessKey' ].forEach(function (option) {
			var value = opts[option];
			if (value) {
				env[option.replace(/[A-Z]/g, '_$&').toUpperCase()] = value;
			}
		});

		var child = grunt.util.spawn({
			cmd: process.argv[0],
			args: args,
			opts: {
				cwd: process.cwd(),
				env: env
			}
		}, function (error, result, code) {
			if (code) {
				done(new Error('Intern exited with code ' + code + '.'));
			}
			else {
				done(true);
			}
		});

		// parse messages from stdout -- assume the json reporter is being used
		child.stdout.on('data', readOutput);

		// just output data received on stderr
		child.stderr.on('data', grunt.log.write);
	});
};
