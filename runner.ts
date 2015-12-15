import PreExecutor from './lib/executors/PreExecutor';
import exitHandler from './lib/exitHandler';

const basePath = process.cwd().replace(/\\/g, '/');
const executor = new PreExecutor({
	basePath,
	executor: 'Runner',
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
});

exitHandler(process, executor.run(), 10000);
