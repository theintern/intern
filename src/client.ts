import { IDefine } from 'dojo/loader'

declare const define: IDefine;

if (typeof process !== 'undefined' && typeof define === 'undefined') {
	(function (this: any) {
		require('dojo/loader')((this.__internConfig = {
			baseUrl: process.cwd().replace(/\\/g, '/'),
			packages: [
				{ name: 'intern', location: __dirname.replace(/\\/g, '/') }
			],
			map: {
				intern: {
					dojo: 'intern/browser_modules/dojo',
					chai: 'intern/browser_modules/chai/chai',
					diff: 'intern/browser_modules/diff/diff'
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
			defaultLoaderOptions: (function (this: any) {
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
