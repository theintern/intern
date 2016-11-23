import { IDefine, IRequire } from 'dojo/loader';

declare const define: IDefine;

if (typeof process !== 'undefined' && typeof define === 'undefined') {
	require('dojo/loader')(((<any> global).__internConfig = {
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
	}), [ 'intern/runner' ]);
}
else {
	const global = (new Function('return this'))();
	const amdRequire: IRequire = <any> require;

	amdRequire([
		'./lib/executors/PreExecutor',
		'./lib/exitHandler'
	], function (PreExecutor, exitHandler) {
		const executor = new PreExecutor.default({
			defaultLoaderOptions: (function () {
				return global;
			})().__internConfig,
			executorId: 'runner'
		});

		exitHandler(process, executor.run(), 10000);
	});
}
