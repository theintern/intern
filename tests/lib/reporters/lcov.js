define([
	'intern!object',
	'intern/chai!assert',
	'dojo/node!istanbul/lib/collector',
	'dojo/node!istanbul/lib/report/lcovonly',
	'dojo/node!fs',
	'../../../lib/reporters/lcov'
], function (registerSuite, assert, Collector, Reporter, fs, lcov) {
	var sessionId = 'foo',
		mockCoverage = {
			'test.js': {
				'path': 'test.js',
				's': {
					'1': 1
				},
				'b': {},
				'f': {},
				'fnMap': {},
				'statementMap': {
					'1': {
						'start': {
							'line': 1,
							'column': 0
						},
						'end': {
							'line': 60,
							'column': 3
						}
					}
				},
				'branchMap': {}
			}
		};

	registerSuite({
		name: 'intern/lib/reporters/lcov',

		'/coverage': function () {
			var collectorCalled = false,
				oldAdd = Collector.prototype.add;

			Collector.prototype.add = function (coverage) {
				collectorCalled = true;
				assert.deepEqual(coverage, mockCoverage, 'Collector#add should be called with the correct mockCoverage object');
			};

			try {
				lcov['/coverage'](sessionId, mockCoverage);
				assert.isTrue(collectorCalled, 'Collector#add should be called when the reporter /coverage method is called');
			}
			finally {
				Collector.prototype.add = oldAdd;
			}
		},

		'/runner/end': function () {
			var writeReportCalled = false,
				oldWriteReport = Reporter.prototype.writeReport;

			Reporter.prototype.writeReport = function (collector) {
				writeReportCalled = true;
				assert.instanceOf(collector, Collector, 'Reporter#writeReport should be called with a Collector');
			};

			try {
				lcov['/runner/end']();
				assert.isTrue(writeReportCalled, 'Reporter#writeReport should be called when the /runner/end method is called');
			}
			finally {
				Reporter.prototype.writeReport = oldWriteReport;
			}
		},

		'File output': function () {
			try {
				lcov['/coverage'](sessionId, mockCoverage);
				lcov['/runner/end']();
				assert.isTrue(fs.existsSync('lcov.info'), 'lcov.info file was written to disk');
				assert(fs.statSync('lcov.info').size > 0, 'lcov.info contains data');
			}
			finally {
				fs.existsSync('lcov.info') && fs.unlinkSync('lcov.info');
			}
		}
	});
});
