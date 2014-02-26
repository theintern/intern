/*jshint node:true */

module.exports = function (grunt) {
	function logOutput(line) {
		var state = 'write';

		if (/(\d+)\/(\d+) tests (pass|fail)/.test(line)) {
			var match = /(\d+)\/(\d+) tests (pass|fail)/.exec(line),
				count = Number(match[1]),
				total = Number(match[2]);
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

	function readOutput(data) {
		var start = 0,
			next;
		
		data = String(data);
		next = data.indexOf('\n', start);

		while (next !== -1) {
			logOutput(data.substring(start, next) + '\n');
			start = next + 1;
			next = data.indexOf('\n', start);
		}

		logOutput(data.substring(start));
	}

	var environmentKeys = {
		sauceUsername: 'SAUCE_USERNAME',
		sauceAccessKey: 'SAUCE_ACCESS_KEY'
	};

	grunt.registerMultiTask('intern', function () {
		var done = this.async(),
			opts = this.options({ runType: 'client' }),
			args = [ require('path').join(__dirname, '..') + '/' + opts.runType + '.js' ],
			env = {};

		[ 'config', 'proxyOnly', 'autoRun' ].forEach(function (option) {
			opts[option] && args.push(option + '=' + opts[option]);
		});

		[ 'reporters', 'suites' ].forEach(function (option) {
			opts[option] && opts[option].forEach(function (value) {
				args.push(option + '=' + value);
			});
		});

		[ 'sauceUsername', 'sauceAccessKey' ].forEach(function (option) {
			var environmentKey = environmentKeys[option];
			env[environmentKey] = opts[option] || process.env[environmentKey];
		});

		var child = grunt.util.spawn({
			cmd: process.argv[0],
			args: args,
			opts: {
				cwd: process.cwd(),
				env: env
			}
		}, done);

		child.stdout.on('data', readOutput);
		child.stderr.on('data', readOutput);
	});
};
