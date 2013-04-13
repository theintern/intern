/**
 * An AMD-compatible, ES3-compatible, Chai assert API-compatible assertion library.
 *
 * Portions of this code are from:
 * Nodeunit <https://github.com/caolan/nodeunit> (c) 2010 Caolan McMahon. MIT license.
 * narwhal.js <http://narwhaljs.org> (c) 2009 Thomas Robinson <280north.com>. MIT license.
 * ChaiJS <http://chaijs.com> (c) 2011-2013 Jake Luer. MIT license.
 */

define([
	'exports',
	'dojo-ts/_base/lang',
	'dojo-ts/json'
], function (exports, lang, JSON) {
	/**
	 * Gets an object's own keys.
	 * TODO: Not necessary with es5-shim.
	 */
	var getObjectKeys = Object.keys || function (obj) {
		var keys = [];
		for (var k in obj) {
			if (obj.hasOwnProperty(k)) {
				keys.push(k);
			}
		}
		return keys;
	};

	function getType(fn) {
		var match = /^\s*function\s*([^(]+)\(/.exec(fn);
		return match && match[1] ? match[1] : 'unknown';
	}

	/**
	 * Convenience function for throwing assertion errors.
	 */
	function fail(actual, expected, message, operator, stackStartFunction) {
		throw new AssertionError({
			message: message,
			actual: actual,
			expected: expected,
			operator: operator,
			stackStartFunction: stackStartFunction
		});
	}

	var sliceArray = Array.prototype.slice,
		objectToString = Object.prototype.toString;

	function AssertionError(options) {
		this.message = options.message;
		this.actual = options.actual;
		this.expected = options.expected;
		this.operator = options.operator;

		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, options.stackStartFunction || fail);
		}
	}

	AssertionError.prototype = lang.delegate(Error.prototype, {
		name: 'AssertionError',
		constructor: assert.AssertionError,
		toString: function () {
			if (this.message) {
				return [ this.name + ':', this.message ].join(' ');
			}
			else {
				return [
					this.name + ':',
					JSON.stringify(this.expected),
					this.operator,
					JSON.stringify(this.actual)
				].join(' ');
			}
		}
	});

	function assert(value, message) {
		if (!value) {
			fail(value, true, message, '==', assert);
		}
	}

	assert.AssertionError = AssertionError;

	assert.fail = fail;

	assert.ok = assert;

	assert.equal = function (actual, expected, message) {
		/*jshint eqeqeq:false */
		if (actual != expected) {
			fail(actual, expected, message, '==', assert.equal);
		}
	};

	assert.notEqual = function (actual, expected, message) {
		/*jshint eqeqeq:false */
		if (actual == expected) {
			fail(actual, expected, message, '!=', assert.notEqual);
		}
	};

	assert.strictEqual = function (actual, expected, message) {
		if (actual !== expected) {
			fail(actual, expected, message, '===', assert.strictEqual);
		}
	};

	assert.notStrictEqual = function (actual, expected, message) {
		if (actual === expected) {
			fail(actual, expected, message, '!==', assert.notStrictEqual);
		}
	};

	(function () {
		function checkDeepEquality(actual, expected) {
			/*jshint eqeqeq:false */

			function objEquiv(a, b) {
				/*jshint maxcomplexity:11 */

				function isArguments(object) {
					return objectToString.call(object) === '[object Arguments]';
				}

				if (a == null || b == null) {
					return false;
				}

				// an identical "prototype" property.
				if (a.prototype !== b.prototype) {
					return false;
				}

				// ~~~I've managed to break Object.keys through screwy arguments passing. Converting to array solves
				// the problem.
				if (isArguments(a)) {
					if (!isArguments(b)) {
						return false;
					}
					a = sliceArray.call(a);
					b = sliceArray.call(b);
					return checkDeepEquality(a, b);
				}

				var aKeys,
					bKeys,
					key,
					i;

				try {
					aKeys = getObjectKeys(a);
					bKeys = getObjectKeys(b);
				}
				// happens when one is a string literal and the other isn't
				catch (e) {
					return false;
				}

				// having the same number of owned properties (keys incorporates hasOwnProperty)
				if (aKeys.length !== bKeys.length) {
					return false;
				}

				// the same set of keys (although not necessarily the same order),
				aKeys.sort();
				bKeys.sort();

				// ~~~cheap key test
				for (i = aKeys.length - 1; i >= 0; i--) {
					if (aKeys[i] !== bKeys[i]) {
						return false;
					}
				}

				// equivalent values for every corresponding key, and
				// ~~~possibly expensive deep test
				for (i = aKeys.length - 1; i >= 0; i--) {
					key = aKeys[i];
					if (!checkDeepEquality(a[key], b[key])) {
						return false;
					}
				}

				return true;
			}

			// 7.1. All identical values are equivalent, as determined by ===.
			if (actual === expected) {
				return true;
			}

			// equivalent if it is also a Date object that refers to the same time.
			else if (actual instanceof Date && expected instanceof Date) {
				return actual.getTime() === expected.getTime();
			}

			// 7.3. Other pairs that do not both pass typeof value == "object",
			// equivalence is determined by ==.
			else if (typeof actual !== 'object' && typeof expected !== 'object') {
				return actual == expected;
			}

			// 7.4. For all other Object pairs, including Array objects, equivalence is
			// determined by having the same number of owned properties (as verified
			// with Object.prototype.hasOwnProperty.call), the same set of keys
			// (although not necessarily the same order), equivalent values for every
			// corresponding key, and an identical "prototype" property. Note: this
			// accounts for both named and indexed properties on Arrays.
			else {
				return objEquiv(actual, expected);
			}
		}

		assert.deepEqual = function (actual, expected, message) {
			if (!checkDeepEquality(actual, expected)) {
				fail(actual, expected, message, 'deepEqual', assert.deepEqual);
			}
		};

		assert.notDeepEqual = function (actual, expected, message) {
			if (checkDeepEquality(actual, expected)) {
				fail(actual, expected, message, 'notDeepEqual', assert.notDeepEqual);
			}
		};
	})();

	(function () {
		function makeScalarAssertion(name, expected, invert) {
			return function (value, message) {
				if ((invert && value === expected) || value !== expected) {
					fail(value, expected, message, invert ? '!==' : '===', assert[name]);
				}
			};
		}

		assert.isTrue = makeScalarAssertion('isTrue', true);
		assert.isFalse = makeScalarAssertion('isFalse', false);
		assert.isNull = makeScalarAssertion('isNull', null);
		assert.isNotNull = makeScalarAssertion('isNotNull', null, true);
		assert.isUndefined = makeScalarAssertion('isUndefined', void 0);
		assert.isDefined = makeScalarAssertion('isUndefined', void 0, true);
	})();

	(function () {
		function makeTypeAssertion(name, expected, invert) {
			return function (value, message) {
				var type = Object.prototype.toString.call(value);
				if ((invert && type === expected) || type !== expected) {
					fail(value, expected, message, name, assert[name]);
				}
			};
		}

		for (var k in { Function: 1, Object: 1, Array: 1, String: 1, Number: 1, Boolean: 1 }) {
			assert['is' + k] = makeTypeAssertion('is' + k, '[object ' + k + ']');
			assert['isNot' + k] = makeTypeAssertion('isNot' + k, '[object ' + k + ']', true);
		}
	})();

	assert.typeOf = function (value, name, message) {
		var actualType = / ([a-z]+)\]$/.exec(objectToString.call(value).toLowerCase())[1];
		if (actualType !== name.toLowerCase()) {
			fail(actualType, name, message, 'typeOf', assert.typeOf);
		}
	};

	assert.notTypeOf = function (value, name, message) {
		var actualType = / ([a-z]+)\]$/.exec(objectToString.call(value).toLowerCase())[1];
		if (actualType === name.toLowerCase()) {
			fail(actualType, name, message, 'notTypeOf', assert.typeOf);
		}
	};

	(function () {
		assert.instanceOf = function (object, constructor, message) {
			if (!(object instanceof constructor)) {
				fail(getType(object.constructor), getType(constructor), message, 'instanceOf', assert.instanceOf);
			}
		};

		assert.notInstanceOf = function (object, constructor, message) {
			if (object instanceof constructor) {
				fail(getType(object.constructor), getType(constructor), message, 'notInstanceOf', assert.instanceOf);
			}
		};
	})();

	(function () {
		/**
		 * TODO: Not necessary with es5-shim.
		 */
		function getIndexOf(haystack, needle) {
			if (haystack.indexOf) {
				return haystack.indexOf(needle);
			}

			for (var i = 0; i < haystack.length; ++i) {
				if (haystack[i] === needle) {
					return i;
				}
			}

			return -1;
		}

		assert.include = function (haystack, needle, message) {
			if (getIndexOf(haystack, needle) === -1) {
				fail('', needle, message, 'include', assert.include);
			}
		};
	})();

	assert.match = function (value, regexp, message) {
		if (!regexp.test(value)) {
			fail(value, regexp, message, 'match', assert.match);
		}
	};

	assert.notMatch = function (value, regexp, message) {
		if (regexp.test(value)) {
			fail(value, regexp, message, 'notMatch', assert.notMatch);
		}
	};

	(function () {
		var NOT_FOUND = {};

		function getProperty(object, name) {
			var parts = [],
				i,
				match;

			name = name.replace(/\[/g, '.[').match(/(\\\.|[^.]+?)+/g);

			for (i = 0; i < name.length; ++i) {
				if ((match = /\[(\d+)\]$/.exec(name[i]))) {
					parts.push(match[1]);
				}
				else {
					parts.push(name[i]);
				}
			}

			for (i = 0; i < parts.length; ++i) {
				if (!(parts[i] in object)) {
					return NOT_FOUND;
				}

				object = object[parts[i]];
			}

			return object;
		}

		assert.property = function (object, property, message) {
			if (!(property in object)) {
				fail(false, true, message, 'in', assert.property);
			}
		};

		assert.notProperty = function (object, property, message) {
			if (property in object) {
				fail(true, false, message, 'notIn', assert.notProperty);
			}
		};

		assert.deepProperty = function (object, property, message) {
			if (getProperty(object, property) === NOT_FOUND) {
				fail(false, true, message, 'deepProperty', assert.deepProperty);
			}
		};

		assert.notDeepProperty = function (object, property, message) {
			if (getProperty(object, property) !== NOT_FOUND) {
				fail(false, true, message, 'notDeepProperty', assert.deepProperty);
			}
		};

		assert.propertyVal = function (object, property, value, message) {
			if (object[property] !== value) {
				fail(object[property], value, message, '===', assert.propertyVal);
			}
		};

		assert.propertyNotVal = function (object, property, value, message) {
			if (object[property] === value) {
				fail(object[property], value, message, '!==', assert.propertyNotVal);
			}
		};

		assert.deepPropertyVal = function (object, property, value, message) {
			var actual = getProperty(object, property);
			if (actual === NOT_FOUND || actual !== value) {
				fail(actual, value, message, '===', assert.deepPropertyVal);
			}
		};

		assert.deepPropertyNotVal = function (object, property, value, message) {
			var actual = getProperty(object, property);
			if (actual === NOT_FOUND || actual === value) {
				fail(actual, value, message, '!==', assert.deepPropertyNotVal);
			}
		};
	})();

	assert.lengthOf = function (object, length, message) {
		if (object == null || !('length' in object) || object.length !== length) {
			fail(object == null ? null : object.length, length, message, 'lengthOf', assert.lengthOf);
		}
	};

	(function () {
		function throws(shouldThrow, fn, constructor, regexp, message) {
			/*jshint maxcomplexity:12 */

			function regexpMatchesError() {
				if (!error) {
					return false;
				}

				if (typeof regexp === 'string') {
					return error.message.indexOf(regexp) > -1;
				}

				return regexp.test(error.message);
			}

			var error,
				threw = false;

			if (arguments.length >= 3 && arguments.length < 5) {
				// if constructor is not a function then the signature is (shouldThrow, fn, regexp [, message])
				if (typeof constructor !== 'function') {
					message = regexp;
					regexp = constructor;
					constructor = undefined;
				}
			}

			try {
				fn();
			}
			catch (e) {
				threw = true;
				error = e;
			}

			if (shouldThrow) {
				if (!threw) {
					fail(threw, shouldThrow, message, 'throw', throws);
				}
				else if (constructor && !(error instanceof constructor)) {
					fail(getType(error.constructor), getType(constructor), message, '===', throws);
				}
				else if (!regexpMatchesError()) {
					fail(error.message, regexp, message, 'throw', throws);
				}
			}
			else {
				if (threw && !constructor && !regexp) {
					fail(threw, shouldThrow, message, 'throw', throws);
				}
				else if (constructor && error instanceof constructor) {
					fail(getType(error.constructor), getType(constructor), message, '!==', throws);
				}
				else if (regexp && regexpMatchesError()) {
					fail(error.message, regexp, message, '===', throws);
				}
			}

			if (threw) {
				throw error;
			}
		}

		assert.throws = assert['throw'] = function (/* block, error, message */) {
			throws.apply(this, [ true ].concat(sliceArray.call(arguments)));
		};

		assert.doesNotThrow = function (/* block, error, message */) {
			throws.apply(this, [ false ].concat(sliceArray.call(arguments)));
		};
	})();

	assert.operator = function (val1, operator, val2, message) {
		/*jshint evil:true */
		var fn = new Function('val1', 'val2', 'return val1 ' + operator + ' val2;');
		if (!fn(val1, val2)) {
			fail(false, true, message, operator, assert.operator);
		}
	};

	assert.closeTo = function (actual, expected, delta, message) {
		if (Math.abs(actual - expected) > delta) {
			fail(actual, (expected + delta) + ' to ' + (expected - delta), message, 'closeTo', assert.closeTo);
		}
	};

	return assert;
});