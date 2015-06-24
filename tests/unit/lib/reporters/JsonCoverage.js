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

				var actual = fs.readFileSync('coverage-final.json', { encoding: 'utf8' });
				var expected = '{\n"test.js":{"path":"test.js","s":{"1":1},"b":{},"f":{},"fnMap":{},' +
					'"statementMap":{"1":{"start":{"line":1,"column":0},"end":{"line":60,"column":3}}},' +
					'"branchMap":{},"l":{"1":1}}}\n';
				assert.equal(actual, expected);
			}
			finally {
				fs.existsSync('coverage-final.json') && fs.unlinkSync('coverage-final.json');
			}
		}
	});
});
