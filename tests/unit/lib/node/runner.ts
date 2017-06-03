import _run from 'src/lib/node/runner';
import Task from '@dojo/core/async/Task';

const { registerSuite } = intern.getInterface('object');
const assert = intern.getAssertions('assert');
const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

registerSuite('lib/node/runner', function () {
	let initializedConfig: any;
	let runValue: Task<void>;
	let removeMocks: () => void;
	let run: typeof _run;

	return {
		before() {
			return mockRequire(require, 'src/lib/node/runner', {
				'src/lib/executors/Node': {
					default: {
						initialize(rawConfig: any) {
							initializedConfig = rawConfig;
							return this;
						},

						run() {
							return runValue || Task.resolve();
						}
					}
				}
			}).then(handle => {
				removeMocks = handle.remove;
				run = handle.module.default;
			});
		},

		after() {
			removeMocks();
		},

		beforeEach() {
			initializedConfig = undefined;
		},

		tests: {
			'run successfully'() {
				return run({ foo: 'bar' }).then(() => {
					assert.deepEqual(initializedConfig, { foo: 'bar' });
				});
			},

			'run fail'() {
				runValue = Task.reject<void>(new Error('failed'));
				return run({ foo: 'bar' }).then(
					() => { throw new Error('run should have failed'); },
					error => assert.equal(error.message, 'failed')
				);
			}
		}
	};
});
