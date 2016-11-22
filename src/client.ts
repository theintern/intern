/* jshint node:true, es3:false */
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
					chai: 'intern/browser_modules/chai/chai',
					diff: 'intern/browser_modules/diff/diff',
					// benchmark requires lodash and platform
					benchmark: 'intern/browser_modules/benchmark/benchmark',
					lodash: 'intern/browser_modules/lodash-amd/main',
					platform: 'intern/browser_modules/platform/platform'
				},
				'*': {
					'intern/dojo': 'intern/browser_modules/dojo'
				}
			}
		}), [ 'intern/client' ]);
	})();
}
else {
	define([
		'./lib/executors/PreExecutor',
		'dojo/has!host-node?./lib/exitHandler'
	], function (PreExecutor, exitHandler) {
		var executor = new PreExecutor({
			defaultLoaderOptions: (function () {
				return this;
			})().__internConfig,
			executorId: 'client'
		});

		var promise = executor.run();

		if (exitHandler) {
			exitHandler(process, promise, 10000);
		}
	});
}
