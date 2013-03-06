define([
	'teststack!object',
	'teststack/chai!assert',
	'teststack-target/lib/Suite',
	'teststack-target/lib/Test',
	'dojo-ts/Deferred'
], function (registerSuite, assert, Suite, Test, Deferred) {
	function createSuiteThrows(method) {
		return function () {
			var dfd = this.async(100),
				suite = new Suite(),
				thrownError = new Error('Oops');

			suite[method] = function () {
				throw thrownError;
			};

			suite.tests.push(new Test({ test: function () {}, parent: suite }));

			suite.run().then(function () {
				dfd.reject(new assert.AssertionError({ message: 'Suite resolved after a fatal error in ' + method + '.' }));
			}, dfd.callback(function (error) {
				assert.strictEqual(suite.error, thrownError, 'Error thrown in ' + method + ' set as error for suite');
				assert.strictEqual(error, thrownError, 'Error thrown in ' + method + ' is error used as reject');
			}));
		};
	}

	registerSuite({
		name: 'teststack/lib/Suite',

		'Suite#setup': function () {
			var dfd = this.async(100),
				suite = new Suite(),
				called = false;

			suite.setup = function () {
				called = true;
			};

			suite.run().then(dfd.callback(function () {
				assert.ok(called, 'Synchronous setup completed');
			}));
		},

		'Suite#beforeEach': function () {
			var dfd = this.async(100),
				suite = new Suite(),
				results = [],
				counter = 0;

			for (var i = 0; i < 2; ++i) {
				suite.tests.push(new Test({ test: function () {
					results.push('' + counter);
				}, parent: suite }));
			}

			suite.beforeEach = function () {
				results.push('b' + (++counter));
			};

			suite.run().then(dfd.callback(function () {
				assert.deepEqual(results, [ 'b1', '1', 'b2', '2' ], 'beforeEach executes before each test');
			}));
		},

		'Suite#afterEach': function () {
			var dfd = this.async(100),
				suite = new Suite(),
				results = [],
				counter = 0;

			for (var i = 0; i < 2; ++i) {
				suite.tests.push(new Test({ test: function () {
					results.push('' + (++counter));
				}, parent: suite }));
			}

			suite.afterEach = function () {
				results.push('a' + counter);
			};

			suite.run().then(dfd.callback(function () {
				assert.deepEqual(results, [ '1', 'a1', '2', 'a2' ], 'afterEach executes after each test');
			}));
		},

		'Suite#teardown': function () {
			var dfd = this.async(100),
				suite = new Suite(),
				called = false;

			suite.teardown = function () {
				called = true;
			};

			suite.run().then(dfd.callback(function () {
				assert.ok(called, 'Synchronous teardown completed');
			}));
		},

		'Suite#setup -> promise': function () {
			var dfd = this.async(100),
				suite = new Suite(),
				waited = false;

			suite.setup = function () {
				var setupDfd = new Deferred();

				setTimeout(function () {
					waited = true;
					setupDfd.resolve();
				}, 20);

				return setupDfd.promise;
			};

			suite.run().then(dfd.callback(function () {
				assert.ok(waited, 'Asynchronous setup completed');
			}));
		},

		'Suite#beforeEach -> promise': function () {
			var dfd = this.async(100),
				suite = new Suite(),
				results = [],
				counter = 0;

			for (var i = 0; i < 2; ++i) {
				suite.tests.push(new Test({ test: function () {
					results.push('' + counter);
				}, parent: suite }));
			}

			suite.beforeEach = function () {
				var beforeEachDfd = new Deferred();

				setTimeout(function () {
					results.push('b' + (++counter));
					beforeEachDfd.resolve();
				}, 20);

				return beforeEachDfd.promise;
			};

			suite.run().then(dfd.callback(function () {
				assert.deepEqual(results, [ 'b1', '1', 'b2', '2' ], 'beforeEach executes before each test');
			}));
		},

		'Suite#afterEach -> promise': function () {
			var dfd = this.async(100),
				suite = new Suite(),
				results = [],
				counter = 0;

			for (var i = 0; i < 2; ++i) {
				suite.tests.push(new Test({ test: function () {
					results.push('' + (++counter));
				}, parent: suite }));
			}

			suite.afterEach = function () {
				var afterEachDfd = new Deferred();

				setTimeout(function () {
					results.push('a' + counter);
					afterEachDfd.resolve();
				}, 20);

				return afterEachDfd.promise;
			};

			suite.run().then(dfd.callback(function () {
				assert.deepEqual(results, [ '1', 'a1', '2', 'a2' ], 'afterEach executes after each test');
			}));
		},

		'Suite#teardown -> promise': function () {
			var dfd = this.async(100),
				suite = new Suite(),
				waited = false;

			suite.teardown = function () {
				var teardownDfd = new Deferred();

				setTimeout(function () {
					waited = true;
					teardownDfd.resolve();
				}, 20);

				return teardownDfd.promise;
			};

			suite.run().then(dfd.callback(function () {
				assert.ok(waited, 'Asynchronous teardown completed');
			}));
		},

		'Suite#name': function () {
			var suite = new Suite({ name: 'foo', parent: new Suite({ name: 'parent' }) });
			assert.strictEqual(suite.name, 'foo', 'Suite#name is correct');
		},

		'Suite#id': function () {
			var suite = new Suite({ name: 'foo', parent: new Suite({ name: 'parent' }) });
			assert.strictEqual(suite.id, 'parent - foo', 'Suite#id is correct');
		},

		'Suite#setup throws': createSuiteThrows('setup'),

		'Suite#beforeEach throws': createSuiteThrows('beforeEach'),

		'Suite#afterEach throws': createSuiteThrows('afterEach'),

		'Suite#teardown throws': createSuiteThrows('teardown')
	});
});