import { AmdLoaderConfig } from './lib/util';
import PreExecutor from './lib/executors/PreExecutor';
import _exitHandlerType from './lib/exitHandler';
import has = require('dojo/has');

let defaultLoaderOptions: AmdLoaderConfig;

if (has('host-node')) {
	/* tslint:disable:no-var-keyword */
	var exitHandler: typeof _exitHandlerType = require('./lib/exitHandler').default;
	/* tslint:enable:no-var-keyword */

	defaultLoaderOptions = {
		baseUrl: process.cwd().replace(/\\/g, '/'),
		packages: [
			{ name: 'intern', location: __dirname.replace(/\\/g, '/') }
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
	};
}
else {
	defaultLoaderOptions = (function () { return this; })().__internConfig;
}

const executor = new PreExecutor({
	defaultLoaderOptions: defaultLoaderOptions,
	executorId: 'client'
});

const promise = executor.run();

if (exitHandler) {
	exitHandler(process, promise, 10000);
}
