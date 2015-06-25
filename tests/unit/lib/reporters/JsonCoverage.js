define([
	'intern!object',
	'intern/chai!assert',
	'dojo/node!istanbul/lib/collector',
	'dojo/node!istanbul/lib/report/json',
	'dojo/node!fs',
	'./support/mocks',
	'../../../../lib/reporters/Json'
], function (registerSuite, assert, Collector, Reporter, fs, mock, Json) {
	var sessionId = 'foo';

	registerSuite({
		name: 'intern/lib/reporters/Json',

		coverage: function () {
			var json = new Json();
			var collectorCalled = false;
			json._collector.add = function (coverage) {
				collectorCalled = true;
				assert.deepEqual(
					coverage,
					mock.coverage,
					'Collector#add should be called with the correct mockCoverage object'
				);
			};

			json.coverage(sessionId, mock.coverage);
			assert.isTrue(
				collectorCalled,
				'Collector#add should be called when the reporter coverage method is called'
			);
		},

		runEnd: function () {
			var json = new Json();

			var writeReportCalled = false;
			json._reporter.writeReport = function (collector) {
				writeReportCalled = true;
				assert.instanceOf(collector, Collector, 'Reporter#writeReport should be called with a Collector');
			};

			json.runEnd();
			assert.isTrue(
				writeReportCalled,
				'Reporter#writeReport should be called when the /runner/end method is called'
			);
		},

		'File output': function () {
			var json = new Json();

			try {
				json.coverage(sessionId, mock.coverage);
				json.runEnd();
				assert.isTrue(fs.existsSync('coverage-final.json'), 'coverage-final.json file was written to disk');
				assert(fs.statSync('coverage-final.json').size > 0, 'coverage-final.json contains data');
			}
			finally {
				fs.existsSync('coverage-final.json') && fs.unlinkSync('coverage-final.json');
			}
		}
	});
});
