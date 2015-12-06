import PreExecutor from './lib/executors/PreExecutor';
import exitHandler from './lib/exitHandler';

const executor = new PreExecutor({
	defaultLoaderOptions: {
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
	},
	executorId: 'runner'
});

exitHandler(process, executor.run(), 10000);
