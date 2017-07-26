import global from '@dojo/shim/global';
import { spy, stub } from 'sinon';
import { LoaderInit } from 'src/lib/executors/Executor';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

const originalIntern = global.intern;
const originalRequire = global.require;

registerSuite('loaders/default', function () {
	let removeMocks: () => void;

	const mockIntern = {
		config: { basePath: '/' },
		emit: spy(() => { }),
		loadScript: stub().resolves(),
		registerLoader: spy((_init: LoaderInit) => { }),
		log: spy(() => { })
	};

	return {
		before() {
			global.intern = mockIntern;
			return mockRequire(require, 'src/loaders/default', {}).then(handle => {
				removeMocks = handle.remove;
				assert.equal(mockIntern.registerLoader.callCount, 1);
			});
		},

		after() {
			global.intern = originalIntern;
			removeMocks();
		},

		beforeEach() {
			global.intern = mockIntern;
			mockIntern.emit.reset();
			mockIntern.loadScript.reset();
			mockIntern.loadScript.resolves();
		},

		afterEach() {
			global.intern = originalIntern;
			global.require = originalRequire;
		},

		tests: {
			init() {
				const init = mockIntern.registerLoader.getCall(0).args[0];
				return Promise.resolve(init({})).then(() => {
					// The default loader doesn't do anythign in its init function
					assert.equal(mockIntern.loadScript.callCount, 0);
				});
			},

			'load Modules'() {
				const init: LoaderInit = mockIntern.registerLoader.getCall(0).args[0];
				return Promise.resolve(init({})).then(loader => {
					return loader(['foo.js']).then(() => {
						assert.equal(mockIntern.loadScript.callCount, 1);
						assert.equal(mockIntern.loadScript.getCall(0).args[0], 'foo.js');
					});
				});
			},

			error() {
				const init: LoaderInit = mockIntern.registerLoader.getCall(0).args[0];
				mockIntern.loadScript.rejects(new Error('fail'));
				return Promise.resolve(init({})).then(loader => {
					return loader(['foo.js']).then(
						() => { throw new Error('should not have succeeded'); },
						error => { assert.match(error.message, /fail/); }
					);
				});
			}
		}
	};
});
