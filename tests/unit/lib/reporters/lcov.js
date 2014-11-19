define([
	'intern!object',
	'intern/chai!assert',
	'dojo/node!istanbul/lib/collector',
	'dojo/node!istanbul/lib/report/lcovonly',
	'dojo/node!fs',
	'./support/mocks',
	'../../../../lib/reporters/lcov'
], function (registerSuite, assert, Collector, Reporter, fs, mock, lcov) {
	var sessionId = 'foo';

	registerSuite({
		name: 'intern/lib/reporters/lcov',

		'/coverage': function () {
			var collectorCalled = false,
				oldAdd = Collector.prototype.add;

			Collector.prototype.add = function (coverage) {
				collectorCalled = true;
				assert.deepEqual(coverage, mock.coverage, 'Collector#add should be called with the correct mockCoverage object');
			};

			try {
				lcov['/coverage'](sessionId, mock.coverage);
				assert.isTrue(collectorCalled, 'Collector#add should be called when the reporter /coverage method is called');
			}
			finally {
				Collector.prototype.add = oldAdd;
			}
		},

		'stop': function () {
			var writeReportCalled = false,
				oldWriteReport = Reporter.prototype.writeReport;

			Reporter.prototype.writeReport = function (collector) {
				writeReportCalled = true;
				assert.instanceOf(collector, Collector, 'Reporter#writeReport should be called with a Collector');
			};

			try {
				lcov.stop();
				assert.isTrue(writeReportCalled, 'Reporter#writeReport should be called when the /runner/end method is called');
			}
			finally {
				Reporter.prototype.writeReport = oldWriteReport;
			}
		},

		'File output': function () {
			try {
				lcov['/coverage'](sessionId, mock.coverage);
				lcov.stop();
				assert.isTrue(fs.existsSync('lcov.info'), 'lcov.info file was written to disk');
				assert(fs.statSync('lcov.info').size > 0, 'lcov.info contains data');
			}
			finally {
				fs.existsSync('lcov.info') && fs.unlinkSync('lcov.info');
			}
		}
	});
});
