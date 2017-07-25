import { spy } from 'sinon';

import MockStream from './support/MockStream';

import Suite from 'src/lib/Suite';
import Test from 'src/lib/Test';
import Executor from 'src/lib/executors/Executor';
import TeamCity from 'src/lib/reporters/TeamCity';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');

const messagePatterns: any = {
	suiteStart: '^##teamcity\\[testSuiteStarted name=\'{name}\'',
	suiteEnd: '^##teamcity\\[testSuiteFinished name=\'{name}\' duration=\'\\d+\'',
	testStart: '^##teamcity\\[testStarted name=\'{name}\'',
	testSkip: '^##teamcity\\[testIgnored name=\'{name}\'',
	testEnd: '^##teamcity\\[testFinished name=\'{name}\' duration=\'\\d+\'',
	testFail: '^##teamcity\\[testFailed name=\'{name}\' message=\'{message}\''
};

function testSuite(suite: Suite, executor: Executor, topic: string, type: string) {
	const output = new MockStream();
	const reporter: any = new TeamCity(executor, { output: output });
	const expected = messagePatterns[topic].replace('{name}', suite.name);

	reporter[topic](suite);
	assert.ok(output.data, 'Data should be output when the reporter ' + topic + ' method is called');
	assert.match(
		output.data,
		new RegExp(expected),
		'Output data for ' + type + ' message should match expected message pattern');
}

function testTest(test: Test, executor: Executor, topic: string, type: string, expectedTopic: string) {
	const output = new MockStream();
	const reporter: any = new TeamCity(executor, { output: output });
	let expected = messagePatterns[expectedTopic].replace('{name}', test.name);

	if (test.error) {
		// n.b., only the `testFail` messagePattern has a `{message}` placeholder
		const errorMessage = reporter._escapeString(intern.formatError(test.error));
		expected = expected.replace('{message}', errorMessage);
	}

	reporter[topic](test);
	assert.ok(output.data, 'Data should be output when the reporter ' + topic + ' method is called');
	assert.match(
		output.data,
		new RegExp(expected),
		'Output data for ' + type + ' should match expected message pattern');
}

registerSuite('lib/reporters/TeamCity', function () {
	const mockExecutor = <any>{
		formatError: spy((error: Error) => intern.formatError(error)),
		on: spy(),
		emit: spy(),
		sourceMapStore: {
			transformCoverage: spy(() => {
				return { map: {} };
			})
		}
	};

	return {
		tests: {
			suiteStart() {
				const suite = new Suite(<any> { name: 'suite', parent: true });
				testSuite(suite, mockExecutor, 'suiteStart', 'testSuiteStarted');
			},

			suiteEnd: {
				'successful suite'() {
					const suite = new Suite({
						name: 'suite',
						parent: <Suite>{
							executor: mockExecutor
						},
						tests: [
							new Test({ name: 'foo', test: () => {}, hasPassed: true })
						]
					});
					Object.defineProperty(suite, 'timeElapsed', { value: 123 });
					testSuite(suite, mockExecutor, 'suiteEnd', 'testSuiteFinished');
				},

				'failed suite'() {
					const suite = new Suite({
						name: 'suite',
						parent: <Suite>{
							executor: mockExecutor
						},
						tests: [
							new Test({ name: 'foo', test: () => {}, hasPassed: false })
						]
					});
					Object.defineProperty(suite, 'timeElapsed', { value: 123 });
					testSuite(suite, mockExecutor, 'suiteEnd', 'testSuiteFinished');
				}
			},

			testStart() {
				const test = new Test({
					name: 'test',
					test: () => {},
					parent: <Suite>{ name: 'parent', id: 'parent' }
				});
				Object.defineProperty(test, 'timeElapsed', { value: 123 });
				testTest(test, mockExecutor, 'testStart', 'testStarted', 'testStart');
			},

			testEnd: {
				pass() {
					const test = new Test({
						name: 'test',
						test: () => {},
						parent: <Suite>{ name: 'parent', id: 'parent' }
					});
					Object.defineProperty(test, 'timeElapsed', { value: 123 });
					testTest(test, mockExecutor, 'testEnd', 'testFinished', 'testEnd');
				},

				fail() {
					const test = new Test({
						name: 'test',
						test: () => {},
						parent: <Suite>{ name: 'parent', id: 'parent' }
					});
					test.error = new Error('Oops');
					Object.defineProperty(test, 'timeElapsed', { value: 123 });
					testTest(test, mockExecutor, 'testEnd', 'testFailed', 'testFail');
				},

				skip() {
					const test = new Test({
						name: 'test',
						test: () => {},
						parent: <Suite>{ name: 'parent', id: 'parent' }
					});
					test.skipped = 'skipped';
					Object.defineProperty(test, 'timeElapsed', { value: 123 });
					testTest(test, mockExecutor, 'testEnd', 'testIgnored', 'testSkip');
				}
			}
		}
	};
});
