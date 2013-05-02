/*jshint node:true */

module.exports = function (grunt) {
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
			opts[option] && (env[{ sauceUsername: 'SAUCE_USERNAME', sauceAccessKey: 'SAUCE_ACCESS_KEY' }[option]] = opts[option]);
		});

		var child = grunt.util.spawn({
			cmd: process.argv[0],
			args: args,
			opts: {
				cwd: require('path').join(__dirname, '..'),
				env: env
			}
		}, done);

		child.stdout.on('data', function (data) {
			grunt.log[/\bPASS/i.test(data) ? 'ok' : /\bFAIL/i.test(data) ? 'error' : 'write'](data);
		});
	});
};