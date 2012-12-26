define([
	'dojo-ts/aspect',
	'../../main',
	'../Suite',
	'../Test'
], function (aspect, main, Suite, Test) {
	return function createSuite(descriptor, parentSuite) {
		parentSuite = parentSuite || main;

		var suite = new Suite({ parent: parentSuite }),
			test;

		parentSuite.tests.push(suite);

		for (var k in descriptor) {
			test = descriptor[k];

			if (k === 'before') {
				k = 'setup';
			}
			if (k === 'after') {
				k = 'teardown';
			}

			switch (k) {
			case 'setup':
			case 'beforeEach':
			case 'afterEach':
			case 'teardown':
				aspect.after(suite, k, test);
				break;
			default:
				if (typeof value !== 'function') {
					suite.tests.push(createSuite(test, suite));
				}
				else {
					suite.tests.push(new Test({ name: k, test: test }));
				}
			}
		}
	};
});