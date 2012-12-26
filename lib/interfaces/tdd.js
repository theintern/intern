define([
	'dojo-ts/aspect',
	'../../main',
	'../Suite',
	'../Test'
], function (aspect, main, Suite, Test) {
	var currentSuite,
		suites = [];

	return {
		suite: function (name, factory) {
			var parentSuite = currentSuite || main;

			currentSuite = new Suite({ name: name, parent: parentSuite });
			parentSuite.tests.push(currentSuite);

			suites.push(parentSuite);
			factory();
			currentSuite = suites.pop();
		},

		test: function (name, test) {
			currentSuite.tests.push(new Test({ name: name, test: test, parent: currentSuite }));
		},

		before: function (fn) {
			aspect.after(currentSuite, 'setup', fn);
		},

		after: function (fn) {
			aspect.after(currentSuite, 'teardown', fn);
		},

		beforeEach: function (fn) {
			aspect.after(currentSuite, 'beforeEach', fn);
		},

		afterEach: function (fn) {
			aspect.after(currentSuite, 'afterEach', fn);
		}
	};
});