define([
	'dojo/aspect',
	'../../main',
	'../Suite',
	'../Test'
], function (aspect, main, Suite, Test) {
	function registerSuite(descriptor, parentSuite) {
		var suite = new Suite({ parent: parentSuite }),
			tests = suite.tests,
			test,
			k;

		parentSuite.tests.push(suite);

		for (k in descriptor) {
			test = descriptor[k];

			if (k === 'before') {
				k = 'setup';
			}
			if (k === 'after') {
				k = 'teardown';
			}

			switch (k) {
			case 'name':
				suite.name = test;
				break;
			case 'setup':
			case 'beforeEach':
			case 'afterEach':
			case 'teardown':
				aspect.after(suite, k, test);
				break;
			default:
				if (typeof test !== 'function') {
					test.name = test.name || k;
					registerSuite(test, suite);
				}
				else {
					tests.push(new Test({ name: k, test: test, parent: suite }));
				}
			}
		}
	}

	return function (mainDescriptor) {
		main.suites.forEach(function (suite) {
			var descriptor = mainDescriptor;

			// enable per-suite closure, to match feature parity with other interfaces like tdd/bdd more closely;
			// without this, it becomes impossible to use the object interface for functional tests since there is no
			// other way to create a closure for each main suite
			if (typeof descriptor === 'function') {
				descriptor = descriptor();
			}

			registerSuite(descriptor, suite);
		});
	};
});
