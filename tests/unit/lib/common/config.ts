import Task from '@dojo/core/async/Task';
import * as _config from 'src/lib/common/config';

registerSuite('lib/common/config', {
	loadConfig: {
		'empty config'() {
			return _config.loadConfig('empty', loadText).then(config => {
				assert.deepEqual(config, {});
			});
		},

		args() {
			return _config
				.loadConfig('extends', loadText, { bar: 123 })
				.then(config => {
					assert.deepEqual(config, { foo: 111, bar: 123 });
				});
		},

		'config is cleaned up'() {
			return _config
				.loadConfig('children', loadText, { config: 'foo' }, 'extender')
				.then(config => {
					assert.notProperty(config, 'config');
					assert.notProperty(config, 'configs');
					assert.notProperty(config, 'extends');
				});
		},

		showConfigs() {
			return _config
				.loadConfig('described', loadText, { showConfigs: true })
				.then(config => {
					assert.property(
						config,
						'configs',
						'expected configs not to have been cleaned up'
					);
					assert.property(
						config,
						'showConfigs',
						'expected args to be mixed in'
					);
				});
		},

		extends() {
			return _config.loadConfig('extends', loadText).then(config => {
				assert.deepEqual(config, { foo: 111, bar: 'bye' });
			});
		},

		'child config'() {
			return _config
				.loadConfig('children', loadText, undefined, 'child')
				.then(config => {
					assert.deepEqual(config, {
						baz: 'hello',
						foo: 222,
						bar: 345
					});
				});
		},

		'child config extends'() {
			return _config
				.loadConfig('children', loadText, undefined, 'extender')
				.then(config => {
					assert.deepEqual(config, {
						foo: 123,
						bar: 345,
						baz: 'hello'
					});
				});
		},

		'missing child config'() {
			return _config
				.loadConfig('children', loadText, undefined, 'bad_child')
				.then(
					() => {
						throw new Error(
							'Missing child config should have errored'
						);
					},
					error => {
						assert.match(error.message, /Unknown child config/);
					}
				);
		},

		'child environment config'() {
			return _config
				.loadConfig('childEnvironment', loadText, undefined, 'child')
				.then(config => {
					assert.deepEqual(
						config.node,
						{ suites: ['baz'], plugins: [{ script: 'bar' }] },
						'child node config should have mixed into parent'
					);
				});
		}
	},

	getConfigDescription() {
		return _config
			.loadConfig('described', loadText, { showConfigs: true })
			.then(config => {
				const desc = _config.getConfigDescription(config);
				assert.equal(
					desc,
					'has children\n\nConfigs:\n  child    (a child)\n  extender'
				);
			});
	},

	parseArgs() {
		const args = _config.parseArgs([
			'foo',
			'bar=5',
			'baz=6',
			'baz=7',
			'baz=8',
			'bif=8f5=324',
			'baf=',
			'bof.foo=42'
		]);
		const expected = {
			foo: true,
			bar: '5',
			baz: ['6', '7', '8'],
			bif: '8f5=324',
			baf: '',
			bof: { foo: '42' }
		};
		assert.propertyVal(
			args,
			'foo',
			expected.foo,
			'bare arg should be parsed as boolean true'
		);
		assert.propertyVal(
			args,
			'bar',
			expected.bar,
			'assigned value should be a string'
		);
		assert.property(
			args,
			'baz',
			'multiply-assigned value should be in args'
		);
		assert.deepEqual(
			args.baz,
			expected.baz,
			'multiply-assigned value should be an array of strings'
		);
		assert.property(args, 'bif', 'arg value containing "=" should exist');
		assert.property(
			args,
			'baf',
			'arg value containing "=" with no value should exist'
		);
		assert.deepEqual(
			args.bof,
			expected.bof,
			'dot-separated key should assign to nested objects'
		);
		assert.deepEqual(args, expected);
	},

	parseJson: {
		'simple object'() {
			assert.deepEqual(_config.parseJson('{"foo":"bar"}'), {
				foo: 'bar'
			});
		},

		'line comment'() {
			assert.deepEqual(
				_config.parseJson(`{
				"foo": "bar", // line comment
				"baz": 10
			}`),
				{ foo: 'bar', baz: 10 }
			);
		},

		'block comment'() {
			assert.deepEqual(
				_config.parseJson(`{
				"baz": 10,
				/*
				"commented": "property",
				*/
				"bif": 5
			}`),
				{ baz: 10, bif: 5 }
			);
		},

		escaping() {
			assert.deepEqual(
				_config.parseJson('{"baz": "He said \\"Hello\\""}'),
				{
					baz: 'He said "Hello"'
				}
			);
			assert.deepEqual(_config.parseJson('{"baz": "Slashy \\\\"}'), {
				baz: 'Slashy \\'
			});
		}
	},

	parseValue: (function() {
		function createValueAssertion(type: _config.TypeName) {
			return (value: any, expected: any, requiredProperty?: string) => {
				const parsed = _config.parseValue(
					'foo',
					value,
					type,
					requiredProperty
				);
				if (expected instanceof RegExp) {
					assert.instanceOf(parsed, RegExp);
					assert.strictEqual(parsed.source, expected.source);
				} else if (typeof expected === 'object') {
					assert.deepEqual(parsed, expected);
				} else {
					assert.strictEqual(parsed, expected);
				}
			};
		}

		function createThrowsAssertion(type: _config.TypeName) {
			return (value: any, message: RegExp, requiredProperty?: string) => {
				assert.throws(() => {
					_config.parseValue('foo', value, type, requiredProperty);
				}, message);
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
				value('', {});

				const throws = createThrowsAssertion('object');
				throws('bad', /Non-object/);
				throws('[1]', /Non-object/);
				throws(
					'{"bad":"bar"}',
					/Invalid value.*missing.*property/,
					'name'
				);
				throws(
					{ bad: 'bar' },
					/Invalid value.*missing.*property/,
					'name'
				);
			},

			'object[]'() {
				const value = createValueAssertion('object[]');
				value(null, []);
				value('{"name":"bar"}', [{ name: 'bar' }]);
				value('{"name":"bar"}', [{ name: 'bar' }], 'name');
				value(
					[{ name: 'bar' }, { name: 'baz' }],
					[{ name: 'bar' }, { name: 'baz' }],
					'name'
				);

				const throws = createThrowsAssertion('object[]');
				throws('bad', /Non-object/);
				throws(
					'{"bad":"bar"}',
					/Invalid value.*missing.*property/,
					'name'
				);
				throws(
					{ bad: 'bar' },
					/Invalid value.*missing.*property/,
					'name'
				);
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
				assert.strictEqual(_config.parseValue('foo', 5, parser), 'foo');
			},

			'invalid type'() {
				assert.throws(() => {
					_config.parseValue('foo', 5, <any>'Date');
				}, /Parser must be/);
			}
		};
	})(),

	setOption() {
		const cfg: any = {};

		// Set a property to an array value
		_config.setOption(cfg, 'foo', ['bar']);
		assert.deepEqual(cfg, { foo: ['bar'] });

		// Overwrite an array property
		_config.setOption(cfg, 'foo', ['baz']);
		assert.deepEqual(cfg, { foo: ['baz'] });

		// Add to an array property
		_config.setOption(cfg, 'foo', ['bif'], true);
		assert.deepEqual(cfg, { foo: ['baz', 'bif'] });

		// Set a different property
		_config.setOption(cfg, 'bar', 23);
		assert.deepEqual(cfg, { foo: ['baz', 'bif'], bar: 23 });

		// Add to a non-array, non-object property
		assert.throws(() => {
			_config.setOption(cfg, 'bar', 25, true);
		}, /Only array or object/);

		// Add to a property with no existing value
		_config.setOption(cfg, 'baz', ['bif'], true);
		assert.deepEqual(cfg, { foo: ['baz', 'bif'], bar: 23, baz: ['bif'] });

		// Set a property to an object value
		_config.setOption(cfg, 'bif', { one: '2' });
		assert.deepEqual(cfg, {
			foo: ['baz', 'bif'],
			bar: 23,
			baz: ['bif'],
			bif: { one: '2' }
		});

		// Add to an object value
		_config.setOption(cfg, 'bif', { two: '3' }, true);
		assert.deepEqual(cfg, {
			foo: ['baz', 'bif'],
			bar: 23,
			baz: ['bif'],
			bif: { one: '2', two: '3' }
		});
	},

	splitConfigPath() {
		assert.deepEqual(_config.splitConfigPath('foo'), {
			configFile: 'foo'
		});
		assert.deepEqual(_config.splitConfigPath('foo@bar'), {
			configFile: 'foo',
			childConfig: 'bar'
		});
		assert.deepEqual(_config.splitConfigPath('foo@'), {
			configFile: 'foo',
			childConfig: ''
		});
		assert.deepEqual(_config.splitConfigPath('@bar'), {
			configFile: '',
			childConfig: 'bar'
		});
		assert.deepEqual(_config.splitConfigPath('./@bar'), {
			configFile: './@bar'
		});
		assert.deepEqual(
			_config.splitConfigPath('node_modules/@dojo/foo/intern.json'),
			{
				configFile: 'node_modules/@dojo/foo/intern.json'
			}
		);
		assert.deepEqual(
			_config.splitConfigPath('node_modules/@dojo/foo/intern.json@wd'),
			{
				configFile: 'node_modules/@dojo/foo/intern.json',
				childConfig: 'wd'
			}
		);
	}
});

function loadText(path: string) {
	if (path === 'extends') {
		return Task.resolve(
			JSON.stringify({
				foo: 111,
				bar: 'bye',
				extends: 'empty'
			})
		);
	}
	if (path === 'children') {
		return Task.resolve(
			JSON.stringify({
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
			})
		);
	}
	if (path === 'childEnvironment') {
		return Task.resolve(
			JSON.stringify({
				node: {
					suites: ['foo'],
					plugins: ['bar']
				},
				baz: 'hello',
				bar: 'bye',
				foo: 222,
				configs: {
					child: {
						bar: 345,
						node: {
							suites: ['baz']
						}
					}
				}
			})
		);
	}
	if (path === 'described') {
		return Task.resolve(
			JSON.stringify({
				description: 'has children',
				configs: {
					child: {
						description: 'a child'
					},
					extender: {
						extends: 'child'
					}
				}
			})
		);
	}
	return Task.resolve('{}');
}
