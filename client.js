/*jshint node:true */
if (typeof process !== 'undefined' && typeof define === 'undefined') {
	var req = require('./dojo/dojo');
	req({
		baseUrl: __dirname + '/../',
		packages: [
			{ name: 'dojo-ts', location: __dirname + '/dojo' },
			{ name: 'teststack', location: __dirname }
		]
	}, [ 'teststack/client' ]);
}
else {
	define([
		'./main',
		'./lib/args',
		'require'
	], function (main, args, require) {
		if (!args.suites) {
			throw new Error('Missing "suites" argument');
		}

		if (args.packages) {
			require({ packages: JSON.parse(args.packages) });
		}

		var deps = args.suites.split(/,\s*/);

		if (!args.reporter) {
			console.info('Defaulting to "console" reporter');
			args.reporter = 'console';
		}

		deps.push('./lib/reporters/' + args.reporter);

		require(deps, function () {
			if (args.autoRun !== 'false') {
				main.run();
			}
		});
	});
}