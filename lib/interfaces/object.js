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

	return function (descriptor) {
		main.suites.forEach(function (suite) {
			registerSuite(descriptor, suite);
		});
	};
});
