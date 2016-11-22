/* jshint node:true */
if (typeof process !== 'undefined' && typeof define === 'undefined') {
	(function () {
		require('dojo/loader')((this.__internConfig = {
			baseUrl: process.cwd().replace(/\\/g, '/'),
			packages: [
				{ name: 'intern', location: __dirname.replace(/\\/g, '/') }
			],
			map: {
				intern: {
					dojo: 'intern/browser_modules/dojo',
					benchmark: 'intern/browser_modules/benchmark/benchmark',
					chai: 'intern/browser_modules/chai/chai',
					diff: 'intern/browser_modules/diff/diff',
					lodash: 'intern/browser_modules/lodash-amd/main',
					platform: 'intern/browser_modules/platform/platform'
				},
				'*': {
					'intern/dojo': 'intern/browser_modules/dojo'
				}
			}
		}), [ 'intern/runner' ]);
	})();
}
else {
	define([
		'./lib/executors/PreExecutor',
		'./lib/exitHandler'
	], function (PreExecutor, exitHandler) {
		var executor = new PreExecutor({
			defaultLoaderOptions: (function () {
				return this;
			})().__internConfig,
			executorId: 'runner'
		});

		exitHandler(process, executor.run(), 10000);
	});
}
