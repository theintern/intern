if (typeof process !== 'undefined' && typeof define === 'undefined') {
	var req = require('./dojo/dojo');
	// TODO: Fix configuration
	req.set(__dirname + '/', undefined, [ 'dojo', { name: 'teststack', location: '.' } ]);
	req(['teststack/runner']);
}
else {
	define([
		'dojo/topic',
		'dojo/aspect',
		'./main',
		'./lib/args',
		'require'
	], function (topic, aspect, main, args, require) {
		aspect.after(topic, 'publish', function () {
			console.log(arguments);
		}, true);

		if (!args.config) {
			throw new Error('Missing "config" argument');
		}

		require([ args.config ], function (config) {
			require(config.deps, function () {
				main.run();
			});
		});
	});
}