/* jshint node:true */
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
		};

		var AMDRequire = require('dojo-loader/loader');
		AMDRequire.config(this.__internConfig);
		AMDRequire([ 'intern/runner' ]);
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
