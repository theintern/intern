/**
 * An AMD-compatible, ES3-compatible, Chai assert API-compatible assertion library.
 *
 * Portions of this code are from:
 * Nodeunit <https://github.com/caolan/nodeunit> (c) 2010 Caolan McMahon. MIT license.
 * narwhal.js <http://narwhaljs.org> (c) 2009 Thomas Robinson <280north.com>. MIT license.
 * ChaiJS <http://chaijs.com> (c) 2011-2013 Jake Luer. MIT license.
 */

define([
	'dojo/_base/lang',
	'dojo/_base/array',
	'dojo/json'
], function (lang, arrayUtil, JSON) {
	var objProto = Object.prototype,
		sliceArray = Array.prototype.slice,
		objectToString = objProto.toString,
		getObjectKeys = function (obj) {
			var keys = [];
			for (var k in obj) {
				keys.push(k);
			}

			// Fix for oldIE bug where own properties like toString are skipped
			// because they shadow non-enumerable Object.prototype properties,
			// for more info see https://github.com/theintern/intern/issues/26
			arrayUtil.forEach(lang._extraNames, function (key) {
				if (obj[key] !== objProto[key]) {
					keys.push(key);
				}
			});

			return keys;
		},
		getIndexOf = function (haystack, needle) {
			if (haystack.indexOf) {
				return haystack.indexOf(needle);
			}

			for (var i = 0; i < haystack.length; ++i) {
				if (i in haystack && haystack[i] === needle) {
					return i;
				}
			}

			return -1;
		},
		inspect = (function () {
			/**
			 * Gets the name of a function, in a cross-browser way.
			 */
			function getName(func) {
				if (func.name) { return func.name; }
				var match = /^\s?function ([^(]*)\(/.exec(func);
				return match && match[1] ? match[1] : '';
			}

			/**
			 * This allows the retrieval of enumerable property names of an object,
			 * inherited or not.
			 */
			function getEnumerableProperties(object) {
				var result = [];
				for (var name in object) {
					result.push(name);
				}
				return result;
			}

			/**
			 * Echos the value of a value. Trys to print the value out
			 * in the best way possible given the different types.
			 */
			function inspect(obj, showHidden, depth) {
				var ctx = {
					showHidden: showHidden,
					seen: [],
					stylize: function (str) { return str; }
				};
				return formatValue(ctx, obj, (typeof depth === 'undefined' ? 2 : depth));
			}

			// https://gist.github.com/1044128/
			var getOuterHTML = function (element) {
				if ('outerHTML' in element) { return element.outerHTML; }
				var ns = 'http://www.w3.org/1999/xhtml';
				var container = document.createElementNS(ns, '_');
				var xmlSerializer = new XMLSerializer();
				var html;
				if (document.xmlVersion) {
					return xmlSerializer.serializeToString(element);
				} else {
					container.appendChild(element.cloneNode(false));
					html = container.innerHTML.replace('><', '>' + element.innerHTML + '<');
					container.innerHTML = '';
					return html;
				}
			};

			// Returns true if object is a DOM element.
			var isDOMElement = function (object) {
				if (typeof HTMLElement === 'object') {
					return object instanceof HTMLElement;
				} else {
					return object &&
					typeof object === 'object' &&
					object.nodeType === 1 &&
					typeof object.nodeName === 'string';
				}
			};

			function formatValue(ctx, value, recurseTimes) {
				/*jshint maxcomplexity:23 */

				// Provide a hook for user-specified inspect functions.
				// Check that value is an object with an inspect function on it
				if (value && typeof value.inspect === 'function' &&
					// Filter out the util module, it's inspect function is special
					value.inspect !== inspect &&
					// Also filter out any prototype objects using the circular check.
					!(value.constructor && value.constructor.prototype === value)) {
					return value.inspect(recurseTimes);
				}

				// Primitive types cannot have properties
				var primitive = formatPrimitive(ctx, value);
				if (primitive) {
					return primitive;
				}

				// If it's DOM elem, get outer HTML.
				if (isDOMElement(value)) {
					return getOuterHTML(value);
				}

				// Make error with message first say the error
				if (isError(value)) {
					return formatError(value);
				}

				// Look up the keys of the object.
				var visibleKeys = getEnumerableProperties(value);
				var keys = visibleKeys;

				// Some type of object without properties can be shortcutted.
				// In IE, errors have a single `stack` property, or if they are vanilla `Error`,
				// a `stack` plus `description` property; ignore those for consistency.
				if (keys.length === 0 || (isError(value) && (
					(keys.length === 1 && keys[0] === 'stack') ||
					(keys.length === 2 && keys[0] === 'description' && keys[1] === 'stack')
					))) {
					if (typeof value === 'function') {
						var name = getName(value);
						var nameSuffix = name ? ': ' + name : '';
						return ctx.stylize('[Function' + nameSuffix + ']', 'special');
					}
					if (isRegExp(value)) {
						return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
					}
					if (isDate(value)) {
						return ctx.stylize(Date.prototype.toUTCString.call(value), 'date');
					}
					if (isError(value)) {
						return formatError(value);
					}
				}
				var base = '',
					array = false,
					braces = ['{', '}'];

				// Make Array say that they are Array
				if (isArray(value)) {
					array = true;
					braces = ['[', ']'];
				}

				// Make functions say that they are functions
				if (typeof value === 'function') {
					var tmpName = getName(value);
					var tmpNameSuffix = tmpName ? ': ' + tmpName : '';
					base = ' [Function' + tmpNameSuffix + ']';
				}

				// Make RegExps say that they are RegExps
				if (isRegExp(value)) {
					base = ' ' + RegExp.prototype.toString.call(value);
				}

				// Make dates with properties first say the date
				if (isDate(value)) {
					base = ' ' + Date.prototype.toUTCString.call(value);
				}

				if (keys.length === 0 && (!array || value.length === 0)) {
					return braces[0] + base + braces[1];
				}

				if (recurseTimes < 0) {
					if (isRegExp(value)) {
						return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
					} else {
						return ctx.stylize('[Object]', 'special');
					}
				}

				ctx.seen.push(value);

				var output;
				if (array) {
					output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
				} else {
					output = arrayUtil.map(keys, function (key) {
						return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
					});
				}

				ctx.seen.pop();

				return reduceToSingleString(output, base, braces);
			}


			function formatPrimitive(ctx, value) {
				switch (typeof value) {
				case 'undefined':
					return ctx.stylize('undefined', 'undefined');

				case 'string':
					var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
					.replace(/'/g, '\\\'')
					.replace(/\\"/g, '"') + '\'';
					return ctx.stylize(simple, 'string');

				case 'number':
					return ctx.stylize('' + value, 'number');

				case 'boolean':
					return ctx.stylize('' + value, 'boolean');
				}
				// For some reason typeof null is "object", so special case here.
				if (value === null) {
					return ctx.stylize('null', 'null');
				}
			}


			function formatError(value) {
				// Normalize error string, correcting an issue with a
				// faulty IE6/7 implementation of Error.prototype.toString
				var errorString = value.toString();
				if (errorString.substring(0, 7) === '[object') {
					var name = value.name ? value.name.toString() : 'Error',
						message = value.message ? value.message.toString() : '';
					if (name && message) {
						errorString = name + ': ' + message;
					} else if (name) {
						errorString = name;
					} else if (message) {
						errorString = message;
					} else {
						errorString = 'Error';
					}
				}
				return '\'' + errorString + '\'';
			}


			function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
				var output = [];
				for (var i = 0, l = value.length; i < l; ++i) {
					if (Object.prototype.hasOwnProperty.call(value, String(i))) {
						output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
							String(i), true));
					} else {
						output.push('');
					}
				}
				arrayUtil.forEach(keys, function (key) {
					if (!key.match(/^\d+$/)) {
						output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
							key, true));
					}
				});
				return output;
			}


			function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
				/*jshint maxcomplexity:14 */

				var name,
					str;

				if (getIndexOf(visibleKeys, key) < 0) {
					name = '[' + key + ']';
				}

				if (!str) {
					if (getIndexOf(ctx.seen, value[key]) < 0) {
						if (recurseTimes === null) {
							str = formatValue(ctx, value[key], null);
						} else {
							str = formatValue(ctx, value[key], recurseTimes - 1);
						}
						if (getIndexOf(str, '\n') > -1) {
							if (array) {
								str = arrayUtil.map(str.split('\n'), function (line) {
									return '  ' + line;
								}).join('\n').substr(2);
							} else {
								str = '\n' + arrayUtil.map(str.split('\n'), function (line) {
									return '   ' + line;
								}).join('\n');
							}
						}
					} else {
						str = ctx.stylize('[Circular]', 'special');
					}
				}
				if (typeof name === 'undefined') {
					if (array && key.match(/^\d+$/)) {
						return str;
					}
					name = JSON.stringify('' + key);
					if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
						name = name.substr(1, name.length - 2);
						name = ctx.stylize(name, 'name');
					} else {
						name = name.replace(/'/g, '\\\'')
						.replace(/\\"/g, '"')
						.replace(/(^"|"$)/g, '\'');
						name = ctx.stylize(name, 'string');
					}
				}

				return name + ': ' + str;
			}


			function reduceToSingleString(output, base, braces) {
				var reduce = function (array, callback, optInitialValue) {
					if ('function' !== typeof callback) {
						throw new TypeError(callback + ' is not a function');
					}
					var index = 0, length = array.length >>> 0, value, isValueSet = false;
					if (1 < arguments.length) {
						value = optInitialValue;
						isValueSet = true;
					}
					for (index = 0; length > index; ++index) {
						if (!array.hasOwnProperty(index)) { continue; }
						if (isValueSet) {
							value = callback(value, array[index], index, array);
						} else {
							value = array[index];
							isValueSet = true;
						}
					}
					if (!isValueSet) {
						throw new TypeError('Reduce of empty array with no initial value');
					}
					return value;
				};
				var numLinesEst = 0;
				var length = reduce(output, function (prev, cur) {
					numLinesEst++;
					if (cur.indexOf('\n') >= 0) { numLinesEst++; }
					return prev + cur.length + 1;
				}, 0);

				if (length > 60) {
					return braces[0] +
					(base === '' ? '' : base + '\n ') +
					' ' +
					output.join(',\n  ') +
					' ' +
					braces[1];
				}

				return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
			}

			function isRegExp(re) {
				return typeof re === 'object' && objectToString.call(re) === '[object RegExp]';
			}

			function isDate(d) {
				return typeof d === 'object' && objectToString.call(d) === '[object Date]';
			}

			function isError(e) {
				return typeof e === 'object' && e instanceof Error;
			}

			return inspect;
		})();

	/**
	 * Indicate whether the given object is an array.
	 */
	function isArray(ar) {
		return ar instanceof Array ||
		(typeof ar === 'object' && objectToString.call(ar) === '[object Array]');
	}

	/**
	 * Indicate whether the given object is an object.
	 */
	function isObject(obj) {
		return obj === Object(obj);
	}

	/**
	 * Verify that the given object is an array or a string.
	 */
	function assertIsArrayOrString(value, message) {
		if (!isArray(value) && 'string' !== typeof value) {
			fail(typeof value, 'Array or string', message || ('expected an array or string'));
		}
	}

	/**
	 * Returns an all-lowercase text value representation of an object via
	 * Object.toString and removes any brackets.
	 */
	function objectType(o) {
		return  (/[a-z]*\]$/).exec(objectToString.call(o).toLowerCase())[0].replace(/\]/g, '');
	}

	/**
	 * Returns the declared type of a constructor as a text value
	 */
	function getType(fn) {
		var match = /^\s*function\s*([^(]+)\(/.exec(fn);
		return match && match[1] ? match[1] : 'unknown';
	}

	/**
	 * Formats different types for clean printing per Chai expectations. This function
	 * is ugly and bulky but necessary to match Chai's error messages exactly. It was
	 * taken from Chai and modified a tad to match some style rules
	 */
	function formatValue(obj) {
		// the `inspect` module exposes a function that checks a given value's type,
		// and returns a formatted string-representation of this value; it was taken
		// from Chai, who in turn took most of it straight from Node.js utils
		// https://github.com/joyent/node/blob/f8c335d0caf47f16d31413f89aa28eda3878e3aa/lib/util.js
		// and it is necessary to stay true to the error messages Chai throws
		var str = inspect(obj),
			type = Object.prototype.toString.call(obj);

		if (str.length >= 40) {
			if (type === '[object Function]') {
				str = (!obj.name || obj.name === '')
					? '[Function]' : ('[Function: ' + obj.name + ']');
				return str;
			}
			else if (type === '[object Array]') {
				str = '[ Array(' + obj.length + ') ]';
				return str;
			}
			else if (type === '[object Object]') {
				var keys = getObjectKeys(obj),
					kstr = keys.length > 2
						? (keys.splice(0, 2).join(', ') + ', ...') : (keys.join(', '));
				str = '{ Object (' + kstr + ') }';
			}
		}
		return str;
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

	assert.ok = function (value, message) {
		return assert(value, message || ('expected ' + formatValue(value) + ' to be truthy'));
	};

	assert.notOk = function (value, message) {
		return assert(!value, message || ('expected ' + formatValue(value) + ' to be falsy'));
	};

	assert.equal = function (actual, expected, message) {
		/*jshint eqeqeq:false */
		if (actual != expected) {
			fail(actual, expected, message ||
				('expected ' + formatValue(actual) + ' to equal ' + formatValue(expected)), '==', assert.equal);
		}
	};

	assert.notEqual = function (actual, expected, message) {
		/*jshint eqeqeq:false */
		if (actual == expected) {
			fail(actual, expected, message ||
				('expected ' + formatValue(actual) + ' to not equal ' + formatValue(expected)), '!=', assert.notEqual);
		}
	};

	assert.strictEqual = function (actual, expected, message) {
		if (actual !== expected) {
			fail(actual, expected, message ||
				('expected ' + formatValue(actual) + ' to equal ' + formatValue(expected)), '===', assert.strictEqual);
		}
	};

	assert.notStrictEqual = function (actual, expected, message) {
		if (actual === expected) {
			fail(actual, expected, message ||
				('expected ' + formatValue(actual) + ' to not equal ' + formatValue(expected)), '!==', assert.notStrictEqual);
		}
	};

	(function () {
		var circularA = [],
			circularB = [];

		function checkDeepEquality(actual, expected) {
			/*jshint eqeqeq:false */

			function objEquiv(a, b) {
				/*jshint maxcomplexity:12 */

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

			// equivalent if key RegExp properties are equal.
			else if (actual instanceof RegExp && expected instanceof RegExp) {
				return actual.source === expected.source &&
					actual.global === expected.global &&
					actual.ignoreCase === expected.ignoreCase &&
					actual.multiline === expected.multiline;
			}

			// 7.3. Other pairs that do not both pass typeof value == "object",
			// equivalence is determined by ==.
			else if (typeof actual !== 'object' && typeof expected !== 'object') {
				return actual == expected;
			}
			
			// two objects with different constructors are not equal.
			else if (actual.constructor !== expected.constructor) {
				return false;
			}

			else if (getIndexOf(circularA, actual) !== -1 && getIndexOf(circularA, actual) === getIndexOf(circularB, expected)) {
				return true;
			}

			else if (getIndexOf(circularA, actual) !== -1 || getIndexOf(circularB, expected) !== -1) {
				return false;
			}

			// 7.4. For all other Object pairs, including Array objects, equivalence is
			// determined by having the same number of owned properties (as verified
			// with Object.prototype.hasOwnProperty.call), the same set of keys
			// (although not necessarily the same order), equivalent values for every
			// corresponding key, and an identical "prototype" property. Note: this
			// accounts for both named and indexed properties on Arrays.
			else {
				circularA.push(actual);
				circularB.push(expected);
				var returnValue = objEquiv(actual, expected);
				circularA.pop();
				circularB.pop();
				return returnValue;
			}
		}

		assert.deepEqual = function (actual, expected, message) {
			if (!checkDeepEquality(actual, expected)) {
				fail(actual, expected, message ||
					('expected ' + formatValue(actual) + ' to deeply equal ' + formatValue(expected)), 'deepEqual', assert.deepEqual);
			}
		};

		assert.notDeepEqual = function (actual, expected, message) {
			if (checkDeepEquality(actual, expected)) {
				fail(actual, expected, message ||
					('expected ' + formatValue(actual) + ' to not deeply equal ' + formatValue(expected)), 'notDeepEqual', assert.notDeepEqual);
			}
		};
	})();


	(function () {
		function makeScalarAssertion(name, expected, defaultMsg, invert) {
			return function (value, message) {
				if ((invert && value === expected) || (!invert && value !== expected)) {
					fail(value, expected, message || ('expected ' + formatValue(value) + ' ' + defaultMsg), invert ? '!==' : '===', assert[name]);
				}
			};
		}

		assert.isTrue = makeScalarAssertion('isTrue', true, 'to be true');
		assert.isFalse = makeScalarAssertion('isFalse', false, 'to be false');
		assert.isNull = makeScalarAssertion('isNull', null, 'to equal null');
		assert.isNotNull = makeScalarAssertion('isNotNull', null, 'to not equal null', true);
		assert.isUndefined = makeScalarAssertion('isUndefined', void 0, 'to equal undefined');
		assert.isDefined = makeScalarAssertion('isDefined', void 0, 'to not equal undefined', true);
	})();

	(function () {
		function makeTypeAssertion(name, expected, stringType, invert) {
			return function (value, message) {
				var type = Object.prototype.toString.call(value);
				var article = ({'a': 1, 'e': 1, 'i': 1, 'o': 1, 'u': 1})[stringType.charAt(0)] ? 'an ' : 'a ';
				if ((invert && type === expected) || (!invert && type !== expected)) {
					message = invert ?
						('expected ' + formatValue(value) + ' not to be ' + article + stringType) :
						('expected ' + formatValue(value) + ' to be ' + article + stringType);


					fail(value, expected, message, name, assert[name]);
				}
			};
		}

		for (var k in { Function: 1, Object: 1, Array: 1, String: 1, Number: 1, Boolean: 1 }) {
			assert['is' + k] = makeTypeAssertion('is' + k, '[object ' + k + ']', k.toLowerCase());
			assert['isNot' + k] = makeTypeAssertion('isNot' + k, '[object ' + k + ']', k.toLowerCase(), true);
		}
	})();

	assert.typeOf = function (value, name, message) {
		var actualType = objectType(value);
		if (actualType !== name.toLowerCase()) {
			fail(actualType, name, message || ('expected ' + formatValue(value) + ' to be a ' + name), 'typeOf', assert.typeOf);
		}
	};

	assert.notTypeOf = function (value, name, message) {
		var actualType = objectType(value);
		if (actualType === name.toLowerCase()) {
			fail(actualType, name, message || ('expected ' + formatValue(value) + ' not to be a ' + name), 'notTypeOf', assert.typeOf);
		}
	};

	(function () {
		var name = function (constructor) {
			return constructor.toString().match(/^function\s*([^\s(]+)/)[1];
		};

		assert.instanceOf = function (object, constructor, message) {
			if (!(object instanceof constructor)) {
				fail(getType(object.constructor), getType(constructor), message ||
					('expected ' + formatValue(object) + ' to be an instance of ' + name(constructor)), 'instanceOf', assert.instanceOf);
			}
		};

		assert.notInstanceOf = function (object, constructor, message) {
			if (object instanceof constructor) {
				fail(getType(object.constructor), getType(constructor), message ||
					('expected ' + formatValue(object) + ' to not be an instance of ' + name(constructor)), 'notInstanceOf', assert.instanceOf);
			}
		};
	})();

	(function () {
		function hasProperty(object, name, value) {
			if (value) {
				return object[name] === value;
			}
			else {
				return object[name] !== undefined;
			}
		}

		assert.include = function (haystack, needle, message) {
			if (isObject(needle)) {
				for (var k in needle) {
					assert(hasProperty(haystack, k, needle[k]));
				}
			}
			else {
				var expected = haystack && (getIndexOf(haystack, needle) !== -1);
				assert(expected, message || ('expected ' + formatValue(haystack) + ' to include '
					+ formatValue(needle)), 'include', assert.include);
			}
		};

		assert.notInclude = function (haystack, needle, message) {
			if (isObject(needle)) {
				for (var k in needle) {
					assert(!hasProperty(haystack, k));
				}
			}
			else {
				var expected = haystack && (getIndexOf(haystack, needle) !== -1);
				assert(!expected, message || ('expected ' + formatValue(haystack) + ' to not include '
					+ formatValue(needle)), 'not include', assert.notInclude);
			}
		};
	})();

	assert.match = function (value, regexp, message) {
		if (!regexp.test(value)) {
			fail(value, regexp, message || ('expected ' + formatValue(value) + ' to match ' + formatValue(regexp)), 'match', assert.match);
		}
	};

	assert.notMatch = function (value, regexp, message) {
		if (regexp.test(value)) {
			fail(value, regexp, message || ('expected ' + formatValue(value) + ' not to match ' + formatValue(regexp)), 'match', assert.match);
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
				if (!object[parts[i]]) {
					return NOT_FOUND;
				}

				object = object[parts[i]];
			}
			return object;
		}

		assert.property = function (object, property, message) {
			if (!object[property]) {
				fail(false, true, message ||
					('expected ' + formatValue(object) + ' to have a property \'' + property + '\''), 'in', assert.property);
			}
		};

		assert.notProperty = function (object, property, message) {
			if (object[property]) {
				fail(true, false, message ||
					('expected ' + formatValue(object) + ' to not have property \'' + property + '\''), 'notIn', assert.notProperty);
			}
		};

		assert.deepProperty = function (object, property, message) {
			if (getProperty(object, property) === NOT_FOUND) {
				fail(false, true, message ||
					('expected ' + formatValue(object) + ' to have a deep property \'' + property + '\''), 'deepProperty', assert.deepProperty);
			}
		};

		assert.notDeepProperty = function (object, property, message) {
			if (getProperty(object, property) !== NOT_FOUND) {
				fail(false, true, message ||
					('expected ' + formatValue(object) + ' to not have deep property \'' + property + '\''), 'notDeepProperty', assert.deepProperty);
			}
		};

		assert.propertyVal = function (object, property, value, message) {
			if (object[property] !== value) {
				fail(object[property], value, message ||
					('expected ' + formatValue(object) + ' to have a property \'' + property + '\' of ' + formatValue(value) + ', but got ' + formatValue(object[property])), '===', assert.propertyVal);
			}
		};

		assert.propertyNotVal = function (object, property, value, message) {
			if (object[property] === value) {
				fail(object[property], value, message ||
					('expected ' + formatValue(object) + ' to not have a property \'' + property + '\' of ' + formatValue(value)), '!==', assert.propertyNotVal);
			}
		};

		assert.deepPropertyVal = function (object, property, value, message) {
			var actual = getProperty(object, property);
			if (actual === NOT_FOUND || actual !== value) {
				fail(actual, value, message ||
					('expected ' + formatValue(object) + ' to have a deep property \'' + property + '\' of ' + formatValue(value) + ', but got ' + formatValue(actual)), '===', assert.deepPropertyVal);
			}
		};

		assert.deepPropertyNotVal = function (object, property, value, message) {
			var actual = getProperty(object, property);
			if (actual === NOT_FOUND || actual === value) {
				fail(actual, value, message ||
					('expected ' + formatValue(object) + ' to not have a deep property \'' + property + '\' of ' + formatValue(value)), '!==', assert.deepPropertyNotVal);
			}
		};
	})();

	assert.lengthOf = function (object, length, message) {
		if (object == null || !object.length) {
			fail(null, length, message || ('expected ' + formatValue(object) + ' to have a property \'length\''),  'lengthOf', assert.lengthOf);
		}
		else if (object.length !== length) {
			fail(object.length, length, message ||
				('expected ' + formatValue(object) + ' to have a length of ' + formatValue(length) + ' but got ' + object.length), 'lengthOf', assert.lengthOf);
		}
	};

	(function () {
		function throws(shouldThrow, fn, constructor, regexp, message) {
			/*jshint maxcomplexity:19 */

			function regexpMatchesError() {
				if (!error) {
					return false;
				}

				if (typeof regexp === 'string') {
					return error.message.indexOf(regexp) > -1;
				}

				return !regexp || regexp.test(error.message);
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
					fail(threw, shouldThrow, message || ('expected ' + formatValue(fn) + ' to throw an error'), 'throw', throws);
				}
				else if (constructor && !(error instanceof constructor)) {
					fail(getType(error.constructor), getType(constructor), message ||
						('expected ' + formatValue(fn) + ' to throw \'TypeError\' but ' + formatValue(error) + ' was thrown'), '===', throws);
				}
				else if (typeof regexp === 'object' && !regexpMatchesError()) {
					fail(error.message, regexp, message ||
						('expected ' + formatValue(fn) + ' to throw error matching ' + formatValue(regexp) + ' but got ' + formatValue(error.message)), 'throw', throws);
				}
				else if (typeof regexp === 'string' && !regexpMatchesError()) {
					fail(error.message, regexp, message ||
						('expected ' + formatValue(fn) + ' to throw error including ' + formatValue(regexp) + ' but got ' + formatValue(error.message)), 'throw', throws);
				}
			}
			else {
				if (threw && !constructor && !regexp) {
					fail(threw, shouldThrow, message ||
						('expected ' + formatValue(fn) + ' to not throw an error but ' + formatValue(error) + ' was thrown'), 'throw', throws);
				}
				else if (constructor && error instanceof constructor) {
					fail(getType(error.constructor), getType(constructor), message ||
						('expected ' + formatValue(fn) + ' to throw an error'), '!==', throws);
				}
				else if (regexp && regexpMatchesError()) {
					fail(error.message, regexp, message, '===', throws);
				}
			}

			if (threw && !shouldThrow) {
				throw error;
			}

			return error;
		}

		assert.throws = assert['throw'] = function (/* block, error, message */) {
			return throws.apply(this, [ true ].concat(sliceArray.call(arguments)));
		};

		assert.doesNotThrow = function (/* block, error, message */) {
			return throws.apply(this, [ false ].concat(sliceArray.call(arguments)));
		};
	})();

	assert.operator = function (val1, operator, val2, message) {
		/*jshint evil:true */
		var result;
		try {
			result = new Function('return ' + val1 + operator + val2)();
		}
		catch (e) {
			fail(false, true, message ||
				('Invalid operator ' + formatValue(operator)), operator, assert.operator);
		}

		!result && fail(false, true, message || ('expected ' + formatValue(val1) + ' to be ' + operator + ' ' + formatValue(val2)), operator, assert.operator);
	};

	assert.closeTo = function (actual, expected, delta, message) {
		if (Math.abs(actual - expected) > delta) {
			fail(actual, (expected + delta) + ' to ' + (expected - delta), message ||
				('expected ' + formatValue(actual) + ' to be close to ' + formatValue(expected) + ' +/- ' + formatValue(delta)), 'closeTo', assert.closeTo);
		}
	};

	(function () {
		function isSubsetOf(subset, superset) {
			return arrayUtil.every(subset, function (item) {
				return getIndexOf(superset, item) !== -1;
			});
		}

		assert.sameMembers = function (superset, subset, message) {
			assertIsArrayOrString(superset);
			assertIsArrayOrString(subset);
			assert(isSubsetOf(superset, subset) && isSubsetOf(subset, superset), message ||
				'expected ' + inspect(superset) + ' to have the same members as ' + inspect(subset));
		};

		assert.includeMembers = function (superset, subset, message) {
			assertIsArrayOrString(superset);
			assertIsArrayOrString(subset);
			assert(isSubsetOf(subset, superset), message ||
				'expected ' + inspect(superset) + ' to be a superset of ' + inspect(subset));
		};
	})();

	assert.ifError = function (value, message) {
		assert(!value, message || ('expected ' + formatValue(value) + ' to be falsy'));
	};

	return assert;
});
