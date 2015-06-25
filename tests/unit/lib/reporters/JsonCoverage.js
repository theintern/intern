define([
	'intern!object',
	'intern/chai!assert',
	'dojo/node!istanbul/lib/collector',
	'dojo/node!istanbul/lib/report/json',
	'dojo/node!fs',
	'./support/mocks',
	'../../../../lib/reporters/JsonCoverage'
], function (registerSuite, assert, Collector, Reporter, fs, mock, JsonCoverage) {
	var sessionId = 'foo';

	registerSuite({
		name: 'intern/lib/reporters/JsonCoverage',

		coverage: function () {
			var jsonCoverage = new JsonCoverage();
			var collectorCalled = false;
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

		runEnd: function () {
			var jsonCoverage = new JsonCoverage();

			var writeReportCalled = false;
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

		'File output': function () {
			var jsonCoverage = new JsonCoverage();

			try {
				jsonCoverage.coverage(sessionId, mock.coverage);
				jsonCoverage.runEnd();
				assert.isTrue(fs.existsSync('coverage-final.json'), 'coverage-final.json file was written to disk');
				assert(fs.statSync('coverage-final.json').size > 0, 'coverage-final.json contains data');
			}
			finally {
				fs.existsSync('coverage-final.json') && fs.unlinkSync('coverage-final.json');
			}
		}
	});
});
