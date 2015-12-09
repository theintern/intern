import registerSuite = require('intern!object');
import { assert } from 'intern/chai!';
import { default as object, Descriptor } from '../../../../lib/interfaces/object';
import Suite from '../../../../lib/Suite';
import Test from '../../../../lib/Test';
import Executor from '../../../../lib/executors/Executor';
import * as main from '../../../../main';

let originalExecutor: Executor;
let rootSuites: Suite[];

registerSuite({
	name: 'intern/lib/interfaces/object',

	setup() {
		originalExecutor = main.executor;
		main.executor = <Executor> {
			register(callback) {
				rootSuites.forEach(callback);
			}
		};
	},

	teardown() {
		main.executor = originalExecutor;
	},

	'Object interface registration': {
		setup() {
			// Normally, the root suites are set up once the runner or client are configured, but we do not execute
			// the Intern under test
			rootSuites = [
				new Suite({ name: 'object test 1' }),
				new Suite({ name: 'object test 2' })
			];
		},

		registration() {
			object({
				name: 'root suite 1',

				'nested suite': {
					'nested test'() {}
				},

				'regular test'() {}
			});

			object(function () {
				return {
					name: 'root suite 2',

					'test 2'() {}
				};
			});

			for (let i = 0, mainSuite: Array<Suite | Test>; mainSuite = rootSuites[i] && rootSuites[i].tests; ++i) {
				const suiteZero = <Suite> mainSuite[0];
				const suiteOne = <Suite> mainSuite[1];

				assert.strictEqual(suiteZero.name, 'root suite 1',
					'Root suite 1 should be the one named "root suite 1"');
				assert.instanceOf(suiteZero, Suite, 'Root suite 1 should be a Suite instance');

				assert.strictEqual(suiteZero.tests.length, 2, 'Root suite should have two tests');

				assert.strictEqual(suiteZero.tests[0].name, 'nested suite',
					'First test of root suite should be the one named "nested suite"');
				assert.instanceOf(suiteZero.tests[0], Suite, 'Nested test suite should be a Suite instance');

				assert.strictEqual((<Suite> suiteZero.tests[0]).tests.length, 1, 'Nested suite should only have one test');

				assert.strictEqual((<Suite> suiteZero.tests[0]).tests[0].name, 'nested test',
					'Test in nested suite should be the one named "test nested suite');
				assert.instanceOf((<Suite> suiteZero.tests[0]).tests[0], Test,
					'Test in nested suite should be a Test instance');

				assert.strictEqual(suiteZero.tests[1].name, 'regular test',
					'Last test in root suite should be the one named "regular test"');
				assert.instanceOf(suiteZero.tests[1], Test, 'Last test in root suite should a Test instance');

				assert.strictEqual(suiteOne.name, 'root suite 2',
					'Root suite 2 should be the one named "root suite 2"');
				assert.instanceOf(suiteOne, Suite, 'Root suite 2 should be a Suite instance');

				assert.strictEqual(suiteOne.tests.length, 1, 'Root suite 2 should have one test');

				assert.strictEqual(suiteOne.tests[0].name, 'test 2',
					'The test in root suite 2 should be the one named "test 2"');
				assert.instanceOf(suiteOne.tests[0], Test, 'test 2 should be a Test instance');
			}
		}
	},

	'Object interface lifecycle methods': {
		setup() {
			rootSuites = [
				new Suite({ name: 'object test 1' })
			];
		},

		'lifecycle methods'() {
			const suiteParams = { name: 'root suite' };
			const results: string[] = [];
			const expectedResults = ['before', 'arg', 'beforeEach', 'arg', 'afterEach', 'arg', 'after', 'arg'];
			const lifecycleMethods = ['setup', 'beforeEach', 'afterEach', 'teardown'];

			expectedResults.forEach(function (method) {
				(<any> suiteParams)[method] = function (arg: string) {
					results.push(method, arg);
				};
			});

			object(suiteParams);

			lifecycleMethods.forEach(function (method) {
				(<any> rootSuites[0].tests[0])[method]('arg');
			});

			assert.deepEqual(results, expectedResults, 'object interface methods should get called when ' +
				'corresponding Suite methods get called.');
		}
	}
});
