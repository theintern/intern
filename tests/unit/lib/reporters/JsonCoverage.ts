import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import Collector = require('dojo/node!istanbul/lib/collector');
import * as fs from 'dojo/node!fs';
import getMock from './support/mocks';
import { JsonCoverage } from '../../../../src/lib/reporters/JsonCoverage';

const sessionId = 'foo';

let mock: any = getMock();

registerSuite({
	name: 'intern/lib/reporters/JsonCoverage',

	coverage() {
		const jsonCoverage = new JsonCoverage();
		let collectorCalled = false;
		jsonCoverage._collector.add = function (coverage) {
			collectorCalled = true;
			assert.deepEqual(
				coverage,
				mock.coverage,
				'Collector#add should be called with the correct mockCoverage object'
			);
		};

		jsonCoverage.coverage(sessionId, mock.coverage);
		assert.isTrue(
			collectorCalled,
			'Collector#add should be called when the reporter coverage method is called'
		);
	},

	runEnd() {
		const jsonCoverage = new JsonCoverage();

		let writeReportCalled = false;
		jsonCoverage._reporter.writeReport = function (collector) {
			writeReportCalled = true;
			assert.instanceOf(collector, Collector, 'Reporter#writeReport should be called with a Collector');
		};

		jsonCoverage.runEnd();
		assert.isTrue(
			writeReportCalled,
			'Reporter#writeReport should be called when the /runner/end method is called'
		);
	},

	'File output'() {
		const jsonCoverage = new JsonCoverage();

		try {
			jsonCoverage.coverage(sessionId, mock.coverage);
			jsonCoverage.runEnd();
			assert.isTrue(fs.existsSync('coverage-final.json'), 'coverage-final.json file was written to disk');

			const actual = fs.readFileSync('coverage-final.json', { encoding: 'utf8' });
			const expected = '{\n"test.js":{"path":"test.js","s":{"1":1},"b":{},"f":{},"fnMap":{},' +
				'"statementMap":{"1":{"start":{"line":1,"column":0},"end":{"line":60,"column":3}}},' +
				'"branchMap":{},"l":{"1":1}}}\n';
			assert.equal(actual, expected);
		}
		finally {
			fs.existsSync('coverage-final.json') && fs.unlinkSync('coverage-final.json');
		}
	}
});
