import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import { Suite} from '../../../../src/lib/Suite';
import { Test} from '../../../../src/lib/Test';
import { JUnit } from '../../../../src/lib/reporters/JUnit';
import expected = require ('dojo/text!../../../../../tests/unit/data/lib/reporters/JUnit/expected.xml');

registerSuite({
	name: 'intern/lib/reporters/JUnit',

	'basic tests': function () {
		const reporter = new JUnit(<any> { output: { write: write, end: write } });
		let report = '';

		function write(data: string): void {
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
						new Test(<any> {
							name: 'test1',
							hasPassed: true,
							timeElapsed: 45
						}),
						new Test(<any> {
							name: 'test2',
							hasPassed: false,
							error: new Error('Oops'),
							timeElapsed: 45
						}),
						new Test(<any> {
							name: 'test3',
							hasPassed: false,
							error: assertionError,
							timeElapsed: 45
						}),
						new Test(<any> {
							name: 'test4',
							hasPassed: false,
							skipped: 'No time for that',
							timeElapsed: 45
						}),
						new Suite(<any> {
							name: 'suite5',
							timeElapsed: 45,
							tests: [
								new Test(<any> { name: 'test5.1', hasPassed: true, timeElapsed: 40 })
							]
						})
					]
				})
			]
		});

		reporter.runEnd(<any> { suites: [ suite ] });

		// make sure slight changes in the stack trace does not cause the test to start failing
		report = report.replace(/(at Test\.)(?:registerSuite\.)?(basic tests )[^<]*/g, '$1$2...');
		assert.strictEqual(report, expected, 'Report should match expected result');
	}
});
