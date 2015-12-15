import { default as PreExecutor, RawInternConfig } from './lib/executors/PreExecutor';
import _exitHandlerType from './lib/exitHandler';
import has = require('dojo/has');

// TODO: Deduplicate with other instances of getGlobal
function getGlobal() {
	return (1, eval)('this');
}

let config: RawInternConfig;

if (has('host-node')) {
	/* tslint:disable:no-var-keyword */
	var exitHandler: typeof _exitHandlerType = require('./lib/exitHandler').default;
	/* tslint:enable:no-var-keyword */

	const basePath = process.cwd().replace(/\\/g, '/');
	config = {
		basePath,
		executor: 'Client',
		loaderOptions: {
			baseUrl: basePath,
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
		}
	};
}
else {
	config = getGlobal().__internConfig;
}

const executor = new PreExecutor(config);
const promise = executor.run();

if (exitHandler) {
	exitHandler(process, promise, 10000);
}
