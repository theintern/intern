/*jshint node:true */

module.exports = function (grunt) {
	grunt.registerMultiTask('intern', function () {
		var done = this.async(),
			opts = this.data,
			args = [ opts.runType ? (opts.runType + '.js') : 'client.js' ];

		[ 'config', 'suites', 'reporters', 'proxyOnly', 'autoRun' ].forEach(function (option) {
			opts[option] && args.push(option + '=' + opts[option]);
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
			done();
		});

		child.stdout.on('data', function (data) {
			grunt.log.write(data);
		});
	});
};