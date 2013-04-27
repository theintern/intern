/*jshint node:true */

module.exports = function (grunt) {
	grunt.registerMultiTask('intern', function () {
		var opts = this.data,
			// Add an initial argument for runner or client depending on runType.
			// This array will eventually be passed to a process spawn call for node.
			args = [ opts.runType ? (opts.runType + '.js') : 'client.js' ];

		// Further populate the arg array based on supported command line options.
		['config', 'suites', 'reporters', 'proxyOnly', 'autoRun'].forEach(function (option) {
			opts[option] && args.push(option + '=' + opts[option]);
		});

		grunt.file.setBase(__dirname.replace(new RegExp('/grunt' + '$'), ''));

		grunt.util.spawn({
			cmd: process.argv[0],
			args: args
		},
		function (error, result) {
			if (result) {
				grunt.log.write(result);
			}
			else if (error) {
				grunt.fail.fatal(result);
			}
		});

		this.async();
	});
};