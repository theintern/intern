/* jshint node:true */
if (typeof process !== 'undefined' && typeof define === 'undefined') {
	(function () {
		require('dojo')((this.__internConfig = {
			baseUrl: process.cwd(),
			packages: [
				{ name: 'intern', location: __dirname }
			],
			map: {
				intern: {
					dojo: 'intern/node_modules/dojo',
					chai: 'intern/node_modules/chai/chai',
					diff: 'intern/node_modules/diff/diff'
				},
				'*': {
					'intern/dojo': 'intern/node_modules/dojo'
				}
			}
		}), [ 'intern/runner' ]);
	})();
}
else {
	define([
		'./lib/executors/PreExecutor'
	], function (PreExecutor) {
		var executor = new PreExecutor({
			defaultLoaderConfig: (function () {
				return this;
			})().__internConfig,
			executorId: 'runner'
		});

		executor.run().then(function () {
			process.exit(0);
		},
		function () {
			process.exit(1);
		});
	});
}
