/* jshint node:true, es3:false */
if (typeof process !== 'undefined' && typeof define === 'undefined') {
	(function () {
		this.__internConfig = {
			baseUrl: process.cwd().replace(/\\/g, '/'),
			packages: [
				{ name: 'intern', location: __dirname.replace(/\\/g, '/') }
			],
			map: {
				intern: {
					dojo: 'intern/browser_modules/dojo',
					chai: 'intern/browser_modules/chai/chai',
					diff: 'intern/browser_modules/diff/diff',
					'dojo-core': 'intern/browser_modules/dojo-core'
				},
				'*': {
					'intern/dojo': 'intern/browser_modules/dojo'
				}
			}
		}

		var AMDRequire = require('dojo-loader/loader');
		AMDRequire.config(this.__internConfig);
		AMDRequire([ 'intern/client' ]);
	})();
}
else {
	define([
		'./lib/executors/PreExecutor',
		'dojo-core/has!host-node?./lib/exitHandler'
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
