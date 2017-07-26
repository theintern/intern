import global from '@dojo/shim/global';
import { spy, stub } from 'sinon';
import { LoaderInit } from 'src/lib/executors/Executor';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

const originalIntern = global.intern;
const originalRequire = global.require;
const originalSystemJS = global.SystemJS;

registerSuite('loaders/systemjs', function () {
	let removeMocks: () => void;

	const mockIntern = {
		// Use whatever the local environment is
		environment: intern.environment,
		config: { basePath: '/' },
		emit: spy(() => { }),
		loadScript: spy(() => Promise.resolve()),
		registerLoader: spy((_init: LoaderInit) => { }),
		log: spy(() => { })
	};

	const fakeRequire: any = spy((_module: string) => {
		return mockSystemJS;
	});

	const mockSystemJS = {
		config: spy(() => { }),
		import: stub().resolves()
	};

	return {
		before() {
			global.intern = mockIntern;
			return mockRequire(require, 'src/loaders/systemjs', {}).then(handle => {
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
			global.require = fakeRequire;
			global.SystemJS = mockSystemJS;
			mockIntern.emit.reset();
			mockIntern.loadScript.reset();
			fakeRequire.reset();
		},

		afterEach() {
			global.intern = originalIntern;
			global.require = originalRequire;
			global.SystemJS = originalSystemJS;
		},

		tests: {
			init() {
				const init = mockIntern.registerLoader.getCall(0).args[0];
				return Promise.resolve(init({})).then(() => {
					if (intern.environment === 'browser') {
						assert.equal(mockIntern.loadScript.callCount, 1);
					}
				});
			},

			'load Modules'() {
				const init: LoaderInit = mockIntern.registerLoader.getCall(0).args[0];
				return Promise.resolve(init({})).then(loader => {
					return loader(['foo.js']).then(() => {
						assert.equal(mockSystemJS.import.callCount, 1);
						assert.deepEqual(mockSystemJS.import.getCall(0).args[0], 'foo.js');
					});
				});
			},

			error() {
				const init: LoaderInit = mockIntern.registerLoader.getCall(0).args[0];
				return Promise.resolve(init({})).then(loader => {
					const error = new Error('fail');
					mockSystemJS.import.callsFake(() => Promise.reject(error));

					return loader(['foo.js']).then(
						() => { throw new Error('should not have succeeded'); },
						error => { assert.match(error.message, /fail/); }
					);
				});
			}
		}
	};
});
