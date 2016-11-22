define([
	'./object',
	'../BenchmarkTest',
	'dojo/aspect'
], function (registerSuite, BenchmarkTest, aspect) {
	function propertyHandler(property, value, suite) {
		if (property === 'beforeEachLoop' || property === 'afterEachLoop') {
			aspect.on(suite, property, value);
			return true;
		}
	}

	function benchmark(mainDescriptor) {
		registerSuite(mainDescriptor, BenchmarkTest, propertyHandler);
	}

	benchmark.async = BenchmarkTest.async;
	benchmark.skip = BenchmarkTest.skip;

	return benchmark;
});
