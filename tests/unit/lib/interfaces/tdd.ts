import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import * as tdd from '../../../../src/lib/interfaces/tdd';
import * as main from '../../../../src/main';
import { Suite } from '../../../../src/lib/Suite';
import { Test } from '../../../../src/lib/Test';

let originalExecutor = main.executor;
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
		main.setExecutor(<any> {
			register: function (callback: (value: Suite, index: number, array: Suite[]) => void) {
				rootSuites.forEach(callback);
			}
		});
		main.executor.register = function (callback) {
			rootSuites.forEach(callback);
		};
	},

	teardown() {
		main.setExecutor(originalExecutor);
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

		let mainSuite: Suite[];

		for (let i = 0; (mainSuite = <Suite[]> (rootSuites[i] && rootSuites[i].tests)); ++i) {
			assert.strictEqual(mainSuite[0].name, 'root suite 1',
				'Root suite 1 should be the one named "root suite 1"');
			assert.instanceOf(mainSuite[0], Suite, 'Root suite 1 should be a Suite instance');

			assert.strictEqual(mainSuite[0].tests.length, 2, 'Root suite should have two tests');

			assert.strictEqual(mainSuite[0].tests[0].name, 'nested suite',
				'First test of root suite should be the one named "nested suite"');
			assert.instanceOf(mainSuite[0].tests[0], Suite, 'Nested test suite should be a Suite instance');

			assert.strictEqual((<Suite> (<Suite> mainSuite[0]).tests[0]).tests.length, 1, 'Nested suite should only have one test');

			assert.strictEqual((<Suite> (<Suite> mainSuite[0]).tests[0]).tests[0].name, 'nested test',
				'Test in nested suite should be the one named "test nested suite');
			assert.instanceOf((<Suite> (<Suite> mainSuite[0]).tests[0]).tests[0], Test,
				'Test in nested suite should be a Test instance');

			assert.strictEqual(mainSuite[0].tests[1].name, 'regular test',
				'Last test in root suite should be the one named "regular test"');
			assert.instanceOf(mainSuite[0].tests[1], Test, 'Last test in root suite should a Test instance');

			assert.strictEqual(mainSuite[1].name, 'root suite 2',
				'Root suite 2 should be the one named "root suite 2"');
			assert.instanceOf(mainSuite[1], Suite, 'Root suite 2 should be a Suite instance');

			assert.strictEqual(mainSuite[1].tests.length, 1, 'Root suite 2 should have one test');

			assert.strictEqual(mainSuite[1].tests[0].name, 'test 2',
				'The test in root suite 2 should be the one named "test 2"');
			assert.instanceOf(mainSuite[1].tests[0], Test, 'test 2 should be a Test instance');
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
		const anyTdd = <any> tdd;

		tdd.suite('root suite', function () {
			lifecycleMethods.forEach(function (method) {
				anyTdd[method](function (test: { name: string }) {
					results.push(method, test && test.name);
				});
				anyTdd[method](function (test: { name: string }) {
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
