/*jshint node:true */

module.exports = function (grunt) {
	grunt.registerMultiTask('intern', function () {
		var done = this.async(),
			opts = this.data.options,
			args = [ this.data.runType ? (this.data.runType + '.js') : 'client.js' ],
			succeeded = true;

		[ 'config', 'proxyOnly', 'autoRun' ].forEach(function (option) {
			opts[option] && args.push(option + '=' + opts[option]);
		});

		if (opts.reporters) {
			if (opts.reporters instanceof Array) {
				opts.reporters.forEach(function (reporter) {
					args.push('reporters=' + reporter);
				});
			}
			else if (typeof opts.reporters === 'string') {
				args.push('reporters=' + args.reporters);
			}
		}

		if (opts.suites) {
			if (opts.suites instanceof Array) {
				opts.suites.forEach(function (suite) {
					args.push('suites=' + suite);
				});
			}
			else if (typeof opts.suites === 'string') {
				args.push('suites=' + args.suites);
			}
		}

		opts.suites && opts.suites.forEach(function (suite) {
			args.push('suites=' + suite);
		});

		var child = grunt.util.spawn({
			cmd: process.argv[0],
			args: args,
			opts: {
				cwd: __dirname.replace(/\/grunt$/, '')
			}
		},
		function (error) {
			if (error) {
				grunt.warn(error);
				done(false);
			}
			done(succeeded);
		});

		child.stdout.on('data', function (data) {
			grunt.log.write(data);
		});
		child.stderr.on('data', function (data) {
			succeeded = false;
			grunt.log.error(data);
		});
	});
};