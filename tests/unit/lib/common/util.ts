import * as util from 'src/lib/common/util';

import Task from '@dojo/core/async/Task';

const { registerSuite } = intern.getInterface('object');
const assert = intern.getAssertions('assert');

registerSuite('lib/common/util', {
	loadConfig: {
		'empty config'() {
			return util.loadConfig('empty', loadText).then(config => {
				assert.deepEqual(config, {});
			});
		},

		args() {
			return util.loadConfig('extends', loadText, { bar: 123 }).then(config => {
				assert.deepEqual(config, { foo: 111, bar: 123 });
			});
		},

		extends() {
			return util.loadConfig('extends', loadText).then(config => {
				assert.deepEqual(config, { foo: 111, bar: 'bye' });
			});
		},

		'child config'() {
			return util.loadConfig('children', loadText, undefined, 'child').then(config => {
				assert.deepEqual(config, { baz: 'hello', foo: 222, bar: 345 });
			});
		},

		'child config extends'() {
			return util.loadConfig('children', loadText, undefined, 'extender').then(config => {
				assert.deepEqual(config, { foo: 123, bar: 345, baz: 'hello' });
			});
		},

		'missing child config'() {
			return util.loadConfig('children', loadText, undefined, 'bad_child').then(
				() => { throw new Error('Missing child config should have errored'); },
				error => { assert.match(error.message, /Unknown child config/); }
			);
		}
	},

	normalizePathEnding() {
		assert.equal(util.normalizePathEnding('foo'), 'foo/', 'path not ending in / should have /');
		assert.equal(util.normalizePathEnding('bar/'), 'bar/', 'path ending in / should be unmodified');
		assert.equal(util.normalizePathEnding(''), '', 'empty path should be unmodified');
	},

	parseArgs() {
		const args = util.parseArgs(['foo', 'bar=5', 'baz=6', 'baz=7', 'baz=8']);
		const expected = { foo: true, bar: '5', baz: ['6', '7', '8'] };
		assert.propertyVal(args, 'foo', expected.foo, 'bare arg should be parsed as boolean true');
		assert.propertyVal(args, 'bar', expected.bar, 'assigned value should be a string');
		assert.property(args, 'baz', 'multiply-assigned value should be in args');
		assert.deepEqual(args.baz, expected.baz, 'multiply-assigned value should be an array of strings');
		assert.deepEqual(args, expected);
	},

	parseJson: {
		'simple object'() {
			assert.deepEqual(util.parseJson('{"foo":"bar"}'), { foo: 'bar' });
		},

		'line comment'() {
			assert.deepEqual(util.parseJson(`{
				"foo": "bar", // line comment
				"baz": 10
			}`), { foo: 'bar', baz: 10 });
		},

		'block comment'() {
			assert.deepEqual(util.parseJson(`{
				"baz": 10,
				/*
				"commented": "property",
				*/
				"bif": 5
			}`), { baz: 10, bif: 5 });
		},

		escaping() {
			assert.deepEqual(util.parseJson('{"baz": "He said \\"Hello\\""}'), { baz: 'He said "Hello"' });
			assert.deepEqual(util.parseJson('{"baz": "Slashy \\\\"}'), { baz: 'Slashy \\' });
		}
	},

	parseValue: (function () {
		function createValueAssertion(type: util.TypeName) {
			return (value: any, expected: any, requiredProperty?: string) => {
				const parsed = util.parseValue('foo', value, type, requiredProperty);
				if (expected instanceof RegExp) {
					assert.instanceOf(parsed, RegExp);
					assert.strictEqual(parsed.source, expected.source);
				}
				else if (typeof expected === 'object') {
					assert.deepEqual(parsed, expected);
				}
				else {
					assert.strictEqual(parsed, expected);
				}
			};
		}

		function createThrowsAssertion(type: util.TypeName) {
			return (value: any, message: RegExp, requiredProperty?: string) => {
				assert.throws(() => { util.parseValue('foo', value, type, requiredProperty); }, message);
			};
		}

		return {
			boolean() {
				const value = createValueAssertion('boolean');
				value(true, true);
				value(false, false);
				value('true', true);
				value('false', false);

				const throws = createThrowsAssertion('boolean');
				throws('5', /Non-boolean/);
			},

			number() {
				const value = createValueAssertion('number');
				value(5, 5);
				value('5', 5);

				const throws = createThrowsAssertion('number');
				throws('a', /Non-numeric/);
			},

			regexp() {
				const value = createValueAssertion('regexp');
				value('5', /5/);
				value(/5/, /5/);

				const throws = createThrowsAssertion('regexp');
				throws(23, /Non-regexp/);
			},

			object() {
				const value = createValueAssertion('object');
				value('{"name":"bar"}', { name: 'bar' });
				value('{"name":"bar"}', { name: 'bar' }, 'name');
				value({ name: 'bar' }, { name: 'bar' }, 'name');
				value('bad', { name: 'bad' }, 'name');

				const throws = createThrowsAssertion('object');
				throws('bad', /Non-object/);
				throws('[1]', /Non-object/);
				throws('{"bad":"bar"}', /Invalid value.*missing.*property/, 'name');
				throws({ bad: 'bar' }, /Invalid value.*missing.*property/, 'name');
			},

			'object[]'() {
				const value = createValueAssertion('object[]');
				value(null, []);
				value('{"name":"bar"}', [{ name: 'bar' }]);
				value('{"name":"bar"}', [{ name: 'bar' }], 'name');
				value([{ name: 'bar' }, { name: 'baz' }], [{ name: 'bar' }, { name: 'baz' }], 'name');

				const throws = createThrowsAssertion('object[]');
				throws('bad', /Non-object/);
				throws('{"bad":"bar"}', /Invalid value.*missing.*property/, 'name');
				throws({ bad: 'bar' }, /Invalid value.*missing.*property/, 'name');
			},

			string() {
				const value = createValueAssertion('string');
				value('test', 'test');
				value('5', '5');

				const throws = createThrowsAssertion('string');
				throws(5, /Non-string/);
			},

			'string[]'() {
				const value = createValueAssertion('string[]');
				value(null, []);
				value('test', ['test']);
				value(['test'], ['test']);

				const throws = createThrowsAssertion('string[]');
				throws(5, /Non-string/);
				throws([5], /Non-string/);
				throws({ name: 'foo' }, /Non-string/);
			},

			'custom parser'() {
				const parser = (_value: any) => {
					return 'foo';
				};
				assert.strictEqual(util.parseValue('foo', 5, parser), 'foo');
			},

			'invalid type'() {
				assert.throws(() => {
					util.parseValue('foo', 5, <any>'Date');
				}, /Parser must be/);
			}
		};
	})(),

	pullFromArray() {
		const arrayTest = (array: any[], value: any, expectedArray: any[], expectedReturn: any) => {
			const returned = util.pullFromArray(array, value);
			assert.deepEqual(array, expectedArray);
			assert.deepEqual(returned, expectedReturn);
		};
		arrayTest([1, 2, 3], 2, [1, 3], [2]);
		arrayTest([1, 2, 2, 3], 2, [1, 3], [2, 2]);
		arrayTest([1, 2, 3], 4, [1, 2, 3], []);
		arrayTest([1, 2, 3], <any>'a', [1, 2, 3], []);
	},

	splitConfigPath() {
		assert.deepEqual(util.splitConfigPath('foo'), { configFile: 'foo', childConfig: undefined });
		assert.deepEqual(util.splitConfigPath('foo@bar'), { configFile: 'foo', childConfig: 'bar' });
		assert.deepEqual(util.splitConfigPath('foo@'), { configFile: 'foo', childConfig: '' });
		assert.deepEqual(util.splitConfigPath('@bar'), { configFile: '', childConfig: 'bar' });
	},

	stringify() {
		assert.equal(util.stringify('foo'), '"foo"');
		assert.equal(util.stringify(5), '5');
		assert.equal(util.stringify(/(.*)/), '"(.*)"');
		assert.equal(util.stringify(function () { return 'foo'; }), `"function () { return 'foo'; }"`);
		assert.equal(util.stringify({}), '{}');
		assert.equal(util.stringify(<any>null), 'null');
		assert.equal(util.stringify(''), '""');
		assert.equal(util.stringify({ foo: 'bar', baz: 10 }), '{"foo":"bar","baz":10}');
	}
});

function loadText(path: string) {
	if (path === 'extends') {
		return Task.resolve(JSON.stringify({
			foo: 111,
			bar: 'bye',
			extends: 'empty'
		}));
	}
	if (path === 'children') {
		return Task.resolve(JSON.stringify({
			baz: 'hello',
			bar: 'bye',
			foo: 222,
			configs: {
				child: {
					bar: 345
				},
				extender: {
					extends: 'child',
					foo: 123
				}
			}
		}));
	}
	return Task.resolve('{}');
}
