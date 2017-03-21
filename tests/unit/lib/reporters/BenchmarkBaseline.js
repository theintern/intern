define([
	'intern!object',
	'intern/chai!assert',
	'../../../../lib/BenchmarkSuite',
	'../../../../lib/ReporterManager',
	'../../../../lib/Suite',
	'../../../../lib/reporters/BenchmarkBaseline'
], function (registerSuite, assert, BenchmarkSuite, ReporterManager, Suite, BenchmarkBaseline) {
	registerSuite({
		name: 'intern/lib/reporters/BenchmarkBaseline',
		basic: function () {
			var reporterManager = new ReporterManager();
			reporterManager.add(BenchmarkBaseline, {});
			var benchmarkSuite = new BenchmarkSuite({
				name: 'benchmarkSuite',
				reporterManager: reporterManager,
			});
			benchmarkSuite.tests = {
				'1' : [ function () {
					var date = Date.now();
					date;
				}, { maxTime: 1 } ]
			};
			return benchmarkSuite.run();
		}
	});
});
