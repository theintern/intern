import _gruntTask from 'src/tasks/intern';
import { spy, stub } from 'sinon';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

registerSuite('tasks/intern', function () {
	const mockDone = stub();

	const mockGrunt = {
		registerMultiTask: spy(() => { }),
		async: spy(() => mockDone),
		options: spy(() => { return { foo: 'bar' }; })
	};

	const mockRun = stub();

	class MockNode {
		config: any;
		run: Function;
		constructor(config: any) {
			executors.push(this);
			this.config = config;
			this.run = mockRun;
		}
	}

	let gruntTask: typeof _gruntTask;
	let executors: MockNode[];
	let removeMocks: () => void;

	return {
		before() {
			return mockRequire(require, 'src/tasks/intern', {
				'src/lib/executors/Node': { default: MockNode },
				'@dojo/shim/global': { default: {} }
			}).then(handle => {
				removeMocks = handle.remove;
				gruntTask = handle.module;
			});
		},

		after() {
			removeMocks();
		},

		beforeEach() {
			mockRun.reset();
			mockRun.resolves();
			mockDone.reset();
			executors = [];
		},

		tests: {
			'task registration'() {
				gruntTask(<any>mockGrunt);
				assert.equal(mockGrunt.registerMultiTask.callCount, 1, 'task should have registered');
				assert.equal(mockGrunt.registerMultiTask.getCall(0).args[0], 'intern', 'unexpected task name');
			},

			'run task'() {
				const dfd = this.async();
				gruntTask(<any>mockGrunt);
				const callback = mockGrunt.registerMultiTask.getCall(0).args[1];
				callback.call(mockGrunt);
				assert.lengthOf(executors, 1, '1 executor should have been created');
				assert.equal(mockRun.callCount, 1, 'intern should have been run');
				assert.deepEqual(executors[0].config, { foo: 'bar' });
				setTimeout(dfd.callback(() => {
					assert.equal(mockDone.callCount, 1);
					// First arg is an error, so it should be undefined here
					assert.isUndefined(mockDone.getCall(0).args[0]);
				}));
			},

			error() {
				const dfd = this.async();
				gruntTask(<any>mockGrunt);
				const callback = mockGrunt.registerMultiTask.getCall(0).args[1];
				const error = new Error('bad');
				mockRun.rejects(error);
				callback.call(mockGrunt);
				assert.lengthOf(executors, 1, '1 executor should have been created');
				assert.equal(mockRun.callCount, 1, 'intern should have been run');
				assert.deepEqual(executors[0].config, { foo: 'bar' });
				setTimeout(dfd.callback(() => {
					assert.equal(mockDone.callCount, 1);
					assert.equal(mockDone.getCall(0).args[0], error);
				}));
			}
		}
	};
});
