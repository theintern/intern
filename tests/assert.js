/**
 * Test cases for the assert module. These tests were based on the ChaiJS assert tests and were modified to maintain
 * Intern styleguide conventions.
 *
 * Portions of this code are from:
 * ChaiJS <http://chaijs.com> (c) 2011-2013 Jake Luer. MIT license.
 */

define([
	'intern!tdd',
	'../assert',
	'dojo/_base/lang'
], function (tdd, assert, lang) {

	/*
	 * Executes a function; an assertion is thrown if this executed function doesn't
	 * throw its own assertion, as it is expected to throw. If this executed function
	 * does throw an assertion, the assertion's message text is compared to the expected
	 * error message text.
	 */
	var err = function (fn, msg) {
		try {
			fn();
		}
		catch (err) {
			if ('string' === typeof msg) {
				assert.equal(err.message, msg, 'Errors should be equal');
			} else {
				assert.match(err.msg, msg, 'Errors should be equal');
			}

			return;
		}

		throw new assert.AssertionError({ message: 'Expected an error' });
	};

	/*
	 * Executes a function; an assertion is thrown if this executed function doesn't
	 * throw its own assertion.
	 */
	var shouldThrow = function (fn, msg) {
		try {
			fn();
		}
		catch (err) {
			return;
		}
		throw new assert.AssertionError({ message: msg || 'Expected an error' });
	};

	tdd.suite('assert', function () {
		tdd.test('assert', function () {
			var foo = 'bar';
			assert(foo == 'bar', 'expected foo to equal `bar`');

			err(function () {
				assert(foo == 'baz', 'expected foo to equal `bar`');
			}, 'expected foo to equal `bar`');
		});

		tdd.test('isTrue', function () {
			assert.isTrue(true);

			err(function () {
				assert.isTrue(false);
			}, 'expected false to be true');

			err(function () {
				assert.isTrue(1);
			}, 'expected 1 to be true');

			err(function () {
				assert.isTrue('test');
			}, 'expected \'test\' to be true');
		});

		tdd.test('ok', function () {
			assert.ok(true);
			assert.ok(1);
			assert.ok('test');

			err(function () {
				assert.ok(false);
			}, 'expected false to be truthy');

			err(function () {
				assert.ok(0);
			}, 'expected 0 to be truthy');

			err(function () {
				assert.ok('');
			}, 'expected \'\' to be truthy');
		});

		tdd.test('isFalse', function () {
			assert.isFalse(false);

			err(function () {
				assert.isFalse(true);
			}, 'expected true to be false');

			err(function () {
				assert.isFalse(0);
			}, 'expected 0 to be false');
		});

		tdd.test('equal', function () {
			var foo;
			assert.equal(foo, undefined);
		});

		tdd.test('typeof / notTypeOf', function () {
			assert.typeOf('test', 'string');
			assert.typeOf(true, 'boolean');
			assert.typeOf(5, 'number');

			err(function () {
				assert.typeOf(5, 'string');
			}, 'expected 5 to be a string');

		});

		tdd.test('notTypeOf', function () {
			assert.notTypeOf('test', 'number');

			err(function () {
				assert.notTypeOf(5, 'number');
			}, 'expected 5 not to be a number');
		});

		tdd.test('instanceOf', function () {
			function Foo() {}
			assert.instanceOf(new Foo(), Foo);

			err(function () {
				assert.instanceOf(5, Foo);
			}, 'expected 5 to be an instance of Foo');

			function CrashyObject() {}
			CrashyObject.prototype.inspect = function () {
				throw new Error('Args inspect() called even though the test passed');
			};
			assert.instanceOf(new CrashyObject(), CrashyObject);
		});

		tdd.test('notInstanceOf', function () {
			function Foo() {}
			assert.notInstanceOf(new Foo(), String);

			err(function () {
				assert.notInstanceOf(new Foo(), Foo);
			}, 'expected {} to not be an instance of Foo');
		});

		tdd.test('isObject', function () {
			function Foo() {}
			assert.isObject({});
			assert.isObject(new Foo());

			err(function () {
				assert.isObject(true);
			}, 'expected true to be an object');

			err(function () {
				assert.isObject(Foo);
			}, 'expected [Function: Foo] to be an object');

			err(function () {
				assert.isObject('foo');
			}, 'expected \'foo\' to be an object');
		});

		tdd.test('isNotObject', function () {
			assert.isNotObject(5);

			err(function () {
				assert.isNotObject({});
			}, 'expected {} not to be an object');
		});

		tdd.test('notEqual', function () {
			assert.notEqual(3, 4);

			err(function () {
				assert.notEqual(5, 5);
			}, 'expected 5 to not equal 5');
		});

		tdd.test('strictEqual', function () {
			assert.strictEqual('foo', 'foo');

			err(function () {
				assert.strictEqual('5', 5);
			}, 'expected \'5\' to equal 5');
		});

		tdd.test('notStrictEqual', function () {
			assert.notStrictEqual(5, '5');

			err(function () {
				assert.notStrictEqual(5, 5);
			}, 'expected 5 to not equal 5');
		});

		tdd.test('deepEqual', function () {
			assert.deepEqual({tea: 'chai'}, {tea: 'chai'});

			err(function () {
				assert.deepEqual({tea: 'chai'}, {tea: 'black'});
			}, 'expected { tea: \'chai\' } to deeply equal { tea: \'black\' }');

			var obja = lang.delegate({ tea: 'chai' });
			var objb = lang.delegate({ tea: 'chai' });

			assert.deepEqual(obja, objb);

			var obj1 = lang.delegate({tea: 'chai'});
			var obj2 = lang.delegate({tea: 'black'});

			err(function () {
				assert.deepEqual(obj1, obj2);
			}, 'expected { tea: \'chai\' } to deeply equal { tea: \'black\' }');
		});

		tdd.test('deepEqual (circular)', function () {
			var circularObject = {},
				secondCircularObject = {};
			circularObject.field = circularObject;
			secondCircularObject.field = secondCircularObject;

			assert.deepEqual(circularObject, secondCircularObject);

			err(function () {
				secondCircularObject.field2 = secondCircularObject;
				assert.deepEqual(circularObject, secondCircularObject);
			}, 'expected { field: [Circular] } to deeply equal { Object (field, field2) }');
		});

		tdd.test('notDeepEqual', function () {
			assert.notDeepEqual({tea: 'jasmine'}, {tea: 'chai'});

			err(function () {
				assert.notDeepEqual({tea: 'chai'}, {tea: 'chai'});
			}, 'expected { tea: \'chai\' } to not deeply equal { tea: \'chai\' }');
		});

		tdd.test('notDeepEqual (circular)', function () {
			var circularObject = {},
				secondCircularObject = { tea: 'jasmine' };
			circularObject.field = circularObject;
			secondCircularObject.field = secondCircularObject;

			assert.notDeepEqual(circularObject, secondCircularObject);

			err(function () {
				delete secondCircularObject.tea;
				assert.notDeepEqual(circularObject, secondCircularObject);
			}, 'expected { field: [Circular] } to not deeply equal { field: [Circular] }');
		});

		tdd.test('isNull', function () {
			assert.isNull(null);

			err(function () {
				assert.isNull(undefined);
			}, 'expected undefined to equal null');
		});

		tdd.test('isNotNull', function () {
			assert.isNotNull(undefined);

			err(function () {
				assert.isNotNull(null);
			}, 'expected null to not equal null');
		});

		tdd.test('isUndefined', function () {
			assert.isUndefined(undefined);

			err(function () {
				assert.isUndefined(null);
			}, 'expected null to equal undefined');
		});

		tdd.test('isDefined', function () {
			assert.isDefined(null);

			err(function () {
				assert.isDefined(undefined);
			}, 'expected undefined to not equal undefined');
		});

		tdd.test('isFunction', function () {
			var func = function () {};
			assert.isFunction(func);

			err(function () {
				assert.isFunction({});
			}, 'expected {} to be a function');
		});

		tdd.test('isNotFunction', function () {
			assert.isNotFunction(5);

			err(function () {
				assert.isNotFunction(function () {});
			}, 'expected [Function] not to be a function');
		});

		tdd.test('isArray', function () {
			assert.isArray([]);
			assert.isArray(new Array());

			err(function () {
				assert.isArray({});
			}, 'expected {} to be an array');
		});

		tdd.test('isNotArray', function () {
			assert.isNotArray(3);

			err(function () {
				assert.isNotArray([]);
			}, 'expected [] not to be an array');

			err(function () {
				assert.isNotArray(new Array());
			}, 'expected [] not to be an array');
		});

		tdd.test('isString', function () {
			assert.isString('Foo');
			assert.isString(new String('foo'));

			err(function () {
				assert.isString(1);
			}, 'expected 1 to be a string');
		});

		tdd.test('isNotString', function () {
			assert.isNotString(3);
			assert.isNotString([ 'hello' ]);

			err(function () {
				assert.isNotString('hello');
			}, 'expected \'hello\' not to be a string');
		});

		tdd.test('isNumber', function () {
			assert.isNumber(1);
			assert.isNumber(Number('3'));

			err(function () {
				assert.isNumber('1');
			}, 'expected \'1\' to be a number');
		});

		tdd.test('isNotNumber', function () {
			assert.isNotNumber('hello');
			assert.isNotNumber([ 5 ]);

			err(function () {
				assert.isNotNumber(4);
			}, 'expected 4 not to be a number');
		});

		tdd.test('isBoolean', function () {
			assert.isBoolean(true);
			assert.isBoolean(false);

			err(function () {
				assert.isBoolean('1');
			}, 'expected \'1\' to be a boolean');
		});

		tdd.test('isNotBoolean', function () {
			assert.isNotBoolean('true');

			err(function () {
				assert.isNotBoolean(true);
			}, 'expected true not to be a boolean');

			err(function () {
				assert.isNotBoolean(false);
			}, 'expected false not to be a boolean');
		});

		tdd.test('include', function () {
			assert.include('foobar', 'bar');
			assert.include([ 1, 2, 3], 3);

			err(function () {
				assert.include('foobar', 'baz');
			}, 'expected \'foobar\' to contain \'baz\'');
		});

		tdd.test('lengthOf', function () {
			assert.lengthOf([1, 2, 3], 3);
			assert.lengthOf('foobar', 6);

			err(function () {
				assert.lengthOf('foobar', 5);
			}, 'expected \'foobar\' to have a length of 5 but got 6');

			err(function () {
				assert.lengthOf(1, 5);
			}, 'expected 1 to have a property \'length\'');
		});

		tdd.test('match', function () {
			assert.match('foobar', /^foo/);
			assert.notMatch('foobar', /^bar/);

			err(function () {
				assert.match('foobar', /^bar/i);
			}, 'expected \'foobar\' to match /^bar/i');

			err(function () {
				assert.notMatch('foobar', /^foo/i);
			}, 'expected \'foobar\' not to match /^foo/i');
		});

		tdd.test('property', function () {
			var obj = { foo: { bar: 'baz' } };
			var simpleObj = { foo: 'bar' };
			assert.property(obj, 'foo');
			assert.deepProperty(obj, 'foo.bar');
			assert.notProperty(obj, 'baz');
			assert.notProperty(obj, 'foo.bar');
			assert.notDeepProperty(obj, 'foo.baz');
			assert.deepPropertyVal(obj, 'foo.bar', 'baz');
			assert.deepPropertyNotVal(obj, 'foo.bar', 'flow');

			err(function () {
				assert.property(obj, 'baz');
			}, 'expected { foo: { bar: \'baz\' } } to have a property \'baz\'');

			err(function () {
				assert.deepProperty(obj, 'foo.baz');
			}, 'expected { foo: { bar: \'baz\' } } to have a deep property \'foo.baz\'');

			err(function () {
				assert.notProperty(obj, 'foo');
			}, 'expected { foo: { bar: \'baz\' } } to not have property \'foo\'');

			err(function () {
				assert.notDeepProperty(obj, 'foo.bar');
			}, 'expected { foo: { bar: \'baz\' } } to not have deep property \'foo.bar\'');

			err(function () {
				assert.propertyVal(simpleObj, 'foo', 'ball');
			}, 'expected { foo: \'bar\' } to have a property \'foo\' of \'ball\', but got \'bar\'');

			err(function () {
				assert.deepPropertyVal(obj, 'foo.bar', 'ball');
			}, 'expected { foo: { bar: \'baz\' } } to have a deep property \'foo.bar\' of \'ball\', but got \'baz\'');

			err(function () {
				assert.propertyNotVal(simpleObj, 'foo', 'bar');
			}, 'expected { foo: \'bar\' } to not have a property \'foo\' of \'bar\'');

			err(function () {
				assert.deepPropertyNotVal(obj, 'foo.bar', 'baz');
			}, 'expected { foo: { bar: \'baz\' } } to not have a deep property \'foo.bar\' of \'baz\'');
		});

		tdd.test('throws', function () {
			assert.throws(function () { throw new Error('foo'); });
			assert.throws(function () { throw new Error('bar'); }, 'bar');
			assert.throws(function () { throw new Error('bar'); }, /bar/);
			assert.throws(function () { throw new Error('bar'); }, Error);
			assert.throws(function () { throw new Error('bar'); }, Error, 'bar');

			err(function () {
				assert.throws(function () { throw new Error('foo'); }, TypeError);
			}, 'expected [Function] to throw \'TypeError\' but [Error: foo] was thrown');

			err(function () {
				assert.throws(function () { throw new Error('foo'); }, 'bar');
			}, 'expected [Function] to throw error including \'bar\' but got \'foo\'');

			err(function () {
				assert.throws(function () { throw new Error('foo'); }, Error, 'bar');
			}, 'expected [Function] to throw error including \'bar\' but got \'foo\'');

			err(function () {
				assert.throws(function () { throw new Error('foo'); }, TypeError, 'bar');
			}, 'expected [Function] to throw \'TypeError\' but [Error: foo] was thrown');

			err(function () {
				assert.throws(function () {});
			}, 'expected [Function] to throw an error');

			err(function () {
				assert.throws(function () { throw new Error(''); }, 'bar');
			}, 'expected [Function] to throw error including \'bar\' but got \'\'');

			err(function () {
				assert.throws(function () { throw new Error(''); }, /bar/);
			}, 'expected [Function] to throw error matching /bar/ but got \'\'');
		});

		tdd.test('doesNotThrow', function () {
			assert.doesNotThrow(function () { });
			assert.doesNotThrow(function () { }, 'foo');

			err(function () {
				assert.doesNotThrow(function () { throw new Error('foo'); });
			}, 'expected [Function] to not throw an error but [Error: foo] was thrown');
		});

		tdd.test('operator', function () {
			assert.operator(1, '<', 2);
			assert.operator(2, '>', 1);
			assert.operator(1, '==', 1);
			assert.operator(1, '<=', 1);
			assert.operator(1, '>=', 1);
			assert.operator(1, '!=', 2);
			assert.operator(1, '!==', 2);

			err(function () {
				assert.operator(1, '=', 2);
			}, 'Invalid operator \'=\'');

			err(function () {
				assert.operator(2, '<', 1);
			}, 'expected 2 to be < 1');

			err(function () {
				assert.operator(1, '>', 2);
			}, 'expected 1 to be > 2');

			err(function () {
				assert.operator(1, '==', 2);
			}, 'expected 1 to be == 2');

			err(function () {
				assert.operator(2, '<=', 1);
			}, 'expected 2 to be <= 1');

			err(function () {
				assert.operator(1, '>=', 2);
			}, 'expected 1 to be >= 2');

			err(function () {
				assert.operator(1, '!=', 1);
			}, 'expected 1 to be != 1');

			err(function () {
				assert.operator(1, '!==', '1');
			}, 'expected 1 to be !== \'1\'');
		});

		tdd.test('closeTo', function () {
			assert.closeTo(1.5, 1.0, 0.5);
			assert.closeTo(10, 20, 20);
			assert.closeTo(-10, 20, 30);

			err(function () {
				assert.closeTo(2, 1.0, 0.5);
			}, 'expected 2 to be close to 1 +/- 0.5');

			err(function () {
				assert.closeTo(-10, 20, 29);
			}, 'expected -10 to be close to 20 +/- 29');
		});

		tdd.test('legacy edge cases', function () {
			assert.notDeepEqual({valueOf: 1}, {}, 'own properties that shadow non-enumerable prototype properties should not be skipped');

			shouldThrow(function () {
				var arr = [1, 2, 3];
				delete arr[2];
				assert.include(arr, undefined);
			}, 'Array#indexOf should skip holes in arrays');
		});
	});
});