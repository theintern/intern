import registerSuite = require('intern!object');
import { assert } from 'intern/chai!';
import * as tdd from '../../../../lib/interfaces/tdd';
import Suite from '../../../../lib/Suite';
import Test from '../../../../lib/Test';
import Executor from '../../../../lib/executors/Executor';
import * as main from '../../../../main';

let originalExecutor: Executor;
let rootSuites: Suite[];

registerSuite({
	name: 'intern/lib/interfaces/tdd',

	beforeEach() {
		// Normally, the root suites are set up once the runner or client are configured, but we do not execute
		// the Intern under test
		rootSuites = [
			new Suite({ name: 'tdd test 1' }),
			new Suite({ name: 'tdd test 2' })
		];
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

	'Basic registration'() {
		tdd.suite('root suite 1', function () {
			tdd.suite('nested suite', function () {
				tdd.test('nested test', function () {});
			});
			tdd.test('regular test', function () {});
		});

		tdd.suite('root suite 2', function () {
			tdd.test('test 2', function () {});
		});

		for (let i = 0, mainSuite: Array<Suite | Test>; (mainSuite = rootSuites[i] && rootSuites[i].tests); ++i) {
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
	},

	'Suite lifecycle methods'() {
		const results: string[] = [];
		const expectedResults = [
			'before', undefined, 'before2', undefined,
			'beforeEach', 'single test', 'beforeEach2', 'single test',
			'afterEach', 'single test', 'afterEach2', 'single test',
			'after', undefined, 'after2', undefined
		];
		const lifecycleMethods = [ 'before', 'beforeEach', 'afterEach', 'after' ];

		tdd.suite('root suite', function () {
			lifecycleMethods.forEach(function (method) {
				(<any> tdd)[method](function (test: Test) {
					results.push(method, test && test.name);
				});
				(<any> tdd)[method](function (test: Test) {
					results.push(method + '2', test && test.name);
				});
			});

			tdd.test('single test', function () {});
		});

		return rootSuites[0].run().then(function () {
			assert.deepEqual(results, expectedResults,
				'TDD interface should correctly register special lifecycle methods on the Suite');
		});
	}
});
