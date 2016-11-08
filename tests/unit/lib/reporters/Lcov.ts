import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import Collector = require('dojo/node!istanbul/lib/collector');
import * as fs from 'dojo/node!fs';
import getMock from './support/mocks';
import { LcovReporter as Lcov } from '../../../../src/lib/reporters/Lcov';

const sessionId = 'foo';

let mock: any = getMock();

registerSuite({
	name: 'intern/lib/reporters/lcov',

	coverage() {
		const lcov = new Lcov();
		let collectorCalled = false;
		lcov._collector.add = function (coverage) {
			collectorCalled = true;
			assert.deepEqual(
				coverage,
				mock.coverage,
				'Collector#add should be called with the correct mockCoverage object'
			);
		};

		lcov.coverage(sessionId, mock.coverage);
		assert.isTrue(
			collectorCalled,
			'Collector#add should be called when the reporter coverage method is called'
		);
	},

	runEnd() {
		const lcov = new Lcov();

		let writeReportCalled = false;
		lcov._reporter.writeReport = function (collector) {
			writeReportCalled = true;
			assert.instanceOf(collector, Collector, 'Reporter#writeReport should be called with a Collector');
		};

		lcov.runEnd();
		assert.isTrue(
			writeReportCalled,
			'Reporter#writeReport should be called when the /runner/end method is called'
		);
	},

	'File output'() {
		const lcov = new Lcov();

		try {
			lcov.coverage(sessionId, mock.coverage);
			lcov.runEnd();
			assert.isTrue(fs.existsSync('lcov.info'), 'lcov.info file was written to disk');

			const actual = fs.readFileSync('lcov.info', { encoding: 'utf8' });
			const expected = 'TN:\nSF:test.js\nFNF:0\nFNH:0\nDA:1,1\nLF:1\nLH:1\nBRF:0\nBRH:0\nend_of_record\n';
			assert.equal(actual, expected);
		}
		finally {
			fs.existsSync('lcov.info') && fs.unlinkSync('lcov.info');
		}
	}
});
