/*jshint node:true */

module.exports = function (grunt) {
	function readOutput(data) {
		var state = /\bPASS/i.test(data) ? 'ok' : /\bFAIL/i.test(data) ? 'error' : 'write';

		state === 'error' && grunt.event.emit('intern.fail', data);
		state === 'ok' && grunt.event.emit('intern.pass', data);
		grunt.log[state](data);
	}

	var environmentKeys = {
		sauceUsername: 'SAUCE_USERNAME',
		sauceAccessKey: 'SAUCE_ACCESS_KEY'
	};

	grunt.registerMultiTask('intern', function () {
		var done = this.async(),
			opts = this.options({ runType: 'client' }),
			args = [ opts.runType + '.js' ],
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
				cwd: require('path').join(__dirname, '..'),
				env: env
			}
		}, done);

		child.stdout.on('data', readOutput);
		child.stderr.on('data', readOutput);
	});
};
