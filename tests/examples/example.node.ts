// Import the proper executor for the current environment
import Node from '../src/lib/executors/Node';
import Suite from '../src/lib/Suite';
import Test from '../src/lib/Test';
import { assert } from 'chai';

Node.initialize({
	name: 'Test config',
	filterErrorStack: true,
	reporters: [ 'simple' ]
});

// For instrumentation to work in Node, any modules that should be instrumented
// must be loaded *after* the Node executor is instantiated.
require('./unit/lib/EnvironmentType');

intern.addTest(new Test({
	name: 'foo',
	test: () => {
		assert(false, 'bad thing happened');
	}
}));

intern.addTest(new Suite({
	name: 'sub',
	tests: [
		new Test({ name: 'foo', test: () => {} }),
		new Test({
			name: 'skipper',
			test: function (this: Test) {
				this.skip();
			}
		})
	]
}));

intern.addTest(new Test({
	name: 'baz',
	test: () => {
		return new Promise(resolve => {
			setTimeout(() => {
				resolve();
			}, 200);
		});
	}
}));

intern.run();
