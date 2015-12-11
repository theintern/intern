import registerSuite = require('intern!object');
import { assert } from 'intern/chai!';

import Suite from './support/MockableSuite';
import Test from './support/MockableTest';
import Executor from '../../../../lib/executors/Executor';
import JUnit from '../../../../lib/reporters/JUnit';
import fs = require('fs');

registerSuite({
	name: 'intern/lib/reporters/JUnit',

	'basic tests': function () {
		const expected = fs.readFileSync('../../data/lib/reporters/JUnit/expected.xml', 'utf8');
		const reporter = new JUnit({ output: <NodeJS.WritableStream> { write: write, end: write } });
		let report = '';
		function write(data: string) {
			report += data;
		}

		const assertionError = new Error('Expected 1 + 1 to equal 3');
		assertionError.name = 'AssertionError';

		const suite = new Suite({
			sessionId: 'foo',
			name: 'chrome 32 on Mac',
			timeElapsed: 1234,
			tests: [
				new Suite({
					name: 'suite1',
					timeElapsed: 1234,
					tests: [
						new Test({
							name: 'test1',
							hasPassed: true,
							timeElapsed: 45
						}),
						new Test({
							name: 'test2',
							hasPassed: false,
							error: new Error('Oops'),
							timeElapsed: 45
						}),
						new Test({
							name: 'test3',
							hasPassed: false,
							error: assertionError,
							timeElapsed: 45
						}),
						new Test({
							name: 'test4',
							hasPassed: false,
							skipped: 'No time for that',
							timeElapsed: 45
						}),
						new Suite({
							name: 'suite5',
							timeElapsed: 45,
							tests: [
								new Test({ name: 'test5.1', hasPassed: true, timeElapsed: 40 })
							]
						})
					]
				})
			]
		});

		reporter.runEnd(<Executor> { suites: [ suite ] });

		// make sure slight changes in the stack trace does not cause the test to start failing
		report = report.replace(/(at Test\.registerSuite\.basic tests )[^<]*/g, '$1...');
		assert.strictEqual(report, expected, 'Report should match expected result');
	}
});
