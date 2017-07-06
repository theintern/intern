import _Browser, { Config } from 'src/lib/executors/Browser';
import { spy } from 'sinon';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

let Browser: typeof _Browser;

let removeMocks: () => void;

function createExecutor(config?: Partial<Config>) {
	const executor = new Browser(config);
	executor.registerLoader((_config: Config) => (_modules: string[]) => Promise.resolve());
	return executor;
}

registerSuite('lib/executors/Browser', function () {
	class MockErrorFormatter {
		format(error: Error) {
			return 'Foo: ' + error.message;
		}
	}

	const mockConsole = {
		log: spy(() => { }),
		warn: spy(() => { }),
		error: spy(() => { })
	};

	const mockChai = {
		assert: 'assert',
		should: spy(() => 'should')
	};

	const mockGlobal = {
		console: mockConsole,
		location: { pathname: '/' },
		'__coverage__': {},
		addEventListener: spy(() => { }),
		document: {
			createElement: spy(() => {
				return {
					addEventListener(_name: string, callback: () => void) {
						callback();
					}
				};
			}),
			body: {
				appendChild: spy(() => { })
			}
		}
	};

	let executor: _Browser;

	return {
		before() {
			return mockRequire(require, 'src/lib/executors/Browser', {
				'src/lib/common/ErrorFormatter': { default: MockErrorFormatter },
				'chai': mockChai,
				'@dojo/shim/global': { default: mockGlobal }
			}).then(handle => {
				removeMocks = handle.remove;
				Browser = handle.module.default;
			});
		},

		after() {
			removeMocks();
		},

		beforeEach() {
			executor = createExecutor();
		},

		afterEach() {
			mockConsole.log.reset();
			mockConsole.warn.reset();
			mockConsole.error.reset();
			mockGlobal.addEventListener.reset();
			mockGlobal.document.createElement.reset();
			mockGlobal.document.body.appendChild.reset();
		},

		tests: {
			construct: {
				'listeners added'() {
					assert.equal(mockGlobal.addEventListener.callCount, 2);
					assert.equal(mockGlobal.addEventListener.getCall(0).args[0], 'unhandledRejection');
					assert.equal(mockGlobal.addEventListener.getCall(1).args[0], 'error');
				},

				'unhandled rejection'() {
					const logger = spy(() => { });
					executor.on('error', logger);
					const handler = mockGlobal.addEventListener.getCall(0).args[1];
					const reason = new Error('foo');
					handler({ reason });
					assert.equal(logger.callCount, 1);
					assert.strictEqual(logger.getCall(0).args[0], reason, 'expected emitted error to be error passed to listener');
				},

				'unhandled error'() {
					const logger = spy(() => { });
					executor.on('error', logger);
					const handler = mockGlobal.addEventListener.getCall(1).args[1];
					handler({ message: 'foo' });
					assert.equal(logger.callCount, 1);
					assert.propertyVal(logger.getCall(0).args[0], 'message', 'foo',
						'expected emitted error to be error passed to listener');
				},

				configure() {
					const configured = createExecutor({ suites: ['foo.js'] });
					assert.deepEqual(configured.config.suites, ['foo.js']);
				}
			},

			'#configure': {
				'suite globs'() {
					executor.configure({ suites: ['**/*.js', 'bar.js'] });
					return executor.run().then(
						() => { throw new Error('run should have failed'); },
						error => assert.match(error.message, /Globs may not be used/)
					);
				}
			},

			'#environment'() {
				assert.equal(executor.environment, 'browser');
			},

			'#loadScript': {
				'null input'() {
					// Verify that it doesn't reject
					assert.throws(() => {
						executor.loadScript(<any>null);
					}, /null/);
				},

				'single script'() {
					return executor.loadScript('foo.js').then(() => {
						const createElement = mockGlobal.document.createElement;
						assert.equal(createElement.callCount, 1);
						assert.equal(createElement.getCall(0).args[0], 'script');
					});
				},

				'multiple scripts'() {
					return executor.loadScript(['foo.js', 'bar.js']).then(() => {
						const createElement = mockGlobal.document.createElement;
						assert.equal(createElement.callCount, 2);
						assert.equal(createElement.getCall(0).args[0], 'script');
						assert.equal(createElement.getCall(1).args[0], 'script');
					});
				}
			},

			'#run'() {
				return executor.run();
			}
		}
	};
});
