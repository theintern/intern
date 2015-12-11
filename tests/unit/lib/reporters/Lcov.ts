import registerSuite = require('intern!object');
import { assert } from 'intern/chai!';
import Collector = require('istanbul/lib/collector');
import fs = require('fs');
import { coverage as mockCoverage } from './support/mocks';
import Lcov from '../../../../lib/reporters/Lcov';
import { CoverageMap } from 'istanbul/lib/instrumenter';

const sessionId = 'foo';

registerSuite({
	name: 'intern/lib/reporters/lcov',

	coverage() {
		const lcov = new Lcov();
		let collectorCalled = false;
		(<any> lcov)._collector.add = function (coverage: CoverageMap) {
			collectorCalled = true;
			assert.deepEqual(
				coverage,
				mockCoverage,
				'Collector#add should be called with the correct mockCoverage object'
			);
		};

		lcov.coverage(sessionId, mockCoverage);
		assert.isTrue(
			collectorCalled,
			'Collector#add should be called when the reporter coverage method is called'
		);
	},

	runEnd() {
		const lcov = new Lcov();

		let writeReportCalled = false;
		(<any> lcov)._reporter.writeReport = function (collector: Collector) {
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
			lcov.coverage(sessionId, mockCoverage);
			lcov.runEnd();
			assert.isTrue(fs.existsSync('lcov.info'), 'lcov.info file was written to disk');
			assert(fs.statSync('lcov.info').size > 0, 'lcov.info contains data');
		}
		finally {
			fs.existsSync('lcov.info') && fs.unlinkSync('lcov.info');
		}
	}
});
