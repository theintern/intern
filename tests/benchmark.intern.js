// This config is used to manually exercise the benchmarking code.
define([ './selftest.intern' ], function (config) {
	config.tunnel = 'NullTunnel';
	config.environments = [ { browserName: 'chrome' } ];

	config.benchmark = true;

	config.benchmarkConfig = {
		filename: 'baselines.json',
		verbosity: 2
	};

	// Benchmark suites
	config.benchmarkSuites = [ 'tests/benchmark/all' ];

	return config;
});
