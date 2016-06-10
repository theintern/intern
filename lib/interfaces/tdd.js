define([
	'dojo/aspect',
	'../../main',
	'../Suite',
	'../Test'
], function (aspect, main, Suite, Test) {
	var currentSuite;
	var suites = [];

	function registerSuite(name, factory) {
		var parentSuite = currentSuite;

		currentSuite = new Suite({ name: name, parent: parentSuite });
		parentSuite.tests.push(currentSuite);

		suites.push(parentSuite);
		factory.call(currentSuite);
		currentSuite = suites.pop();
	}

	return {
		suite: function (name, factory) {
			if (/* is a root suite */ !currentSuite) {
				main.executor.register(function (suite) {
					currentSuite = suite;
					registerSuite(name, factory);
					currentSuite = null;
				});
			}
			else {
				registerSuite(name, factory);
			}
		},

		test: function (name, test) {
			// If the test function takes an argument, wrap it with deffered object to
			// gently run asynchronous tests against callback-style
			// for the compatibility with other test frameworks
			if (test.length === 1) {
				var oldTest = test;

				test = function () {
					var dfd = this.async();
					var callback = dfd.callback(function (error) {
						if (error) {
							throw error;
						}
					});

					return oldTest(callback);
				};
			}

			currentSuite.tests.push(new Test({ name: name, test: test, parent: currentSuite }));
		},

		before: function (fn) {
			aspect.on(currentSuite, 'setup', fn);
		},

		after: function (fn) {
			aspect.on(currentSuite, 'teardown', fn);
		},

		beforeEach: function (fn) {
			aspect.on(currentSuite, 'beforeEach', fn);
		},

		afterEach: function (fn) {
			aspect.on(currentSuite, 'afterEach', fn);
		}
	};
});
