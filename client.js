/*jshint node:true */
if (typeof process !== 'undefined' && typeof define === 'undefined') {
	var req = require('./dojo/dojo');
	req({
		baseUrl: __dirname + '/',
		packages: [ 'dojo', { name: 'teststack', location: '.' } ]
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

		var deps = args.suites.split(/,\s*/);

		if (!args.reporter) {
			console.info('Defaulting to "console" reporter');
			args.reporter = 'console';
		}

		deps.push('./lib/reporters/' + args.reporter);

		require(deps, function () {
			main.run();
		});
	});
}