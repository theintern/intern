if (typeof process !== 'undefined' && typeof define === 'undefined') {
	require('./dojo/dojo')([ 'runner' ]);
}

define([
	'./lib/args',
	'require'
], function (args, require) {
	function runTests() {
		Array.prototype.slice.call(arguments, 0).forEach(function (suite) {
			console.log(suite);
		});
	}

	if (!args.config) {
		throw new Error('Missing "config" argument');
	}

	require([ args.config ], function (config) {
		require(config.deps, runTests);
	});
});