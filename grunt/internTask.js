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
			if (typeof opts.reporters === 'string') {
				args.push('reporters=' + args.reporters);
			}
			else {
				opts.reporters.forEach(function (reporter) {
					args.push('reporters=' + reporter);
				});
			}
		}

		if (opts.suites) {
			if (typeof opts.suites === 'string') {
				args.push('suites=' + args.suites);
			}
			else {
				opts.suites.forEach(function (suite) {
					args.push('suites=' + suite);
				});
			}
		}

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