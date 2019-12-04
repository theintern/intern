import { Task } from 'src/common';

import * as util from 'src/core/lib/common/util';
import { Config } from 'src/core/lib/common/config';

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

    'config is cleaned up'() {
      return util
        .loadConfig('children', loadText, { config: 'foo' }, 'extender')
        .then(config => {
          assert.notProperty(config, 'config');
          assert.notProperty(config, 'configs');
          assert.notProperty(config, 'extends');
        });
    },

    showConfigs() {
      return util
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
      return util.loadConfig('extends', loadText).then(config => {
        assert.deepEqual(config, { foo: 111, bar: 'bye' });
      });
    },

    'child config'() {
      return util
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
      return util
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
      return util.loadConfig('children', loadText, undefined, 'bad_child').then(
        () => {
          throw new Error('Missing child config should have errored');
        },
        error => {
          assert.match(error.message, /Unknown child config/);
        }
      );
    },

    'child environment config'() {
      return util
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

  getBasePath() {
    // posix path with absolute base
    const basePath1 = util.getBasePath(
      'intern.json',
      '/',
      path => path[0] === '/'
    );
    assert.equal(basePath1, '/');

    // posix path with absolute base
    const basePath2 = util.getBasePath(
      '/foo/bar/intern.json',
      '/baz',
      path => path[0] === '/'
    );
    assert.equal(basePath2, '/baz');

    // posix path with relative base
    const basePath3 = util.getBasePath(
      '/foo/bar/intern.json',
      '..',
      path => path[0] === '/'
    );
    assert.equal(basePath3, '/foo');

    // Windows path with absolute base
    const basePath4 = util.getBasePath(
      'C:\\foo\\bar\\intern.json',
      'C:\\baz',
      _path => true
    );
    assert.equal(basePath4, 'C:\\baz');

    // Windows path with relative base
    const basePath5 = util.getBasePath(
      'C:\\foo\\bar\\intern.json',
      '..',
      _path => false
    );
    assert.equal(basePath5, 'C:\\foo');
  },

  getConfigDescription() {
    return util
      .loadConfig('described', loadText, { showConfigs: true })
      .then(config => {
        const desc = util.getConfigDescription(config);
        assert.equal(
          desc,
          'has children\n\nConfigs:\n  child    (a child)\n  extender'
        );
      });
  },

  parseArgs() {
    const args = util.parseArgs([
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
    assert.property(args, 'baz', 'multiply-assigned value should be in args');
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
      assert.deepEqual(util.parseJson('{"foo":"bar"}'), {
        foo: 'bar'
      });
    },

    'line comment'() {
      assert.deepEqual(
        util.parseJson(`{
				"foo": "bar", // line comment
				"baz": 10
			}`),
        { foo: 'bar', baz: 10 }
      );
    },

    'block comment'() {
      assert.deepEqual(
        util.parseJson(`{
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
      assert.deepEqual(util.parseJson('{"baz": "He said \\"Hello\\""}'), {
        baz: 'He said "Hello"'
      });
      assert.deepEqual(util.parseJson('{"baz": "Slashy \\\\"}'), {
        baz: 'Slashy \\'
      });
    }
  },

  parseValue: (function() {
    function createValueAssertion(type: util.TypeName) {
      return (value: any, expected: any, requiredProperty?: string) => {
        const parsed = util.parseValue('foo', value, type, requiredProperty);
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

    function createThrowsAssertion(type: util.TypeName) {
      return (value: any, message: RegExp, requiredProperty?: string) => {
        assert.throws(() => {
          util.parseValue('foo', value, type, requiredProperty);
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
        throws('{"bad":"bar"}', /Invalid value.*missing.*property/, 'name');
        throws({ bad: 'bar' }, /Invalid value.*missing.*property/, 'name');
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

  setOption() {
    const cfg: any = {};

    // Set a property to an array value
    util.setOption(cfg, <keyof Config>'foo', ['bar']);
    assert.deepEqual(cfg, { foo: ['bar'] });

    // Overwrite an array property
    util.setOption(cfg, <keyof Config>'foo', ['baz']);
    assert.deepEqual(cfg, { foo: ['baz'] });

    // Add to an array property
    util.setOption(cfg, <keyof Config>'foo', ['bif'], true);
    assert.deepEqual(cfg, { foo: ['baz', 'bif'] });

    // Set a different property
    util.setOption(cfg, <keyof Config>'bar', 23);
    assert.deepEqual(cfg, { foo: ['baz', 'bif'], bar: 23 });

    // Add to a non-array, non-object property
    assert.throws(() => {
      util.setOption(cfg, <keyof Config>'bar', 25, true);
    }, /Only array or object/);

    // Add to a property with no existing value
    util.setOption(cfg, <keyof Config>'baz', ['bif'], true);
    assert.deepEqual(cfg, { foo: ['baz', 'bif'], bar: 23, baz: ['bif'] });

    // Set a property to an object value
    util.setOption(cfg, <keyof Config>'bif', { one: '2' });
    assert.deepEqual(cfg, {
      foo: ['baz', 'bif'],
      bar: 23,
      baz: ['bif'],
      bif: { one: '2' }
    });

    // Add to an object value
    util.setOption(cfg, <keyof Config>'bif', { two: '3' }, true);
    assert.deepEqual(cfg, {
      foo: ['baz', 'bif'],
      bar: 23,
      baz: ['bif'],
      bif: { one: '2', two: '3' }
    });
  },

  splitConfigPath() {
    assert.deepEqual(util.splitConfigPath('foo'), {
      configFile: 'foo'
    });
    assert.deepEqual(util.splitConfigPath('foo@bar'), {
      configFile: 'foo',
      childConfig: 'bar'
    });
    assert.deepEqual(util.splitConfigPath('foo@'), {
      configFile: 'foo',
      childConfig: ''
    });
    assert.deepEqual(util.splitConfigPath('@bar'), {
      configFile: '',
      childConfig: 'bar'
    });
    assert.deepEqual(util.splitConfigPath('./@bar'), {
      configFile: './@bar'
    });
    assert.deepEqual(
      util.splitConfigPath('node_modules/@dojo/foo/intern.json'),
      {
        configFile: 'node_modules/@dojo/foo/intern.json'
      }
    );
    assert.deepEqual(
      util.splitConfigPath('node_modules/@dojo/foo/intern.json@wd'),
      {
        configFile: 'node_modules/@dojo/foo/intern.json',
        childConfig: 'wd'
      }
    );
  },

  pullFromArray() {
    const arrayTest = (
      array: any[],
      value: any,
      expectedArray: any[],
      expectedReturn: any
    ) => {
      const returned = util.pullFromArray(array, value);
      assert.deepEqual(array, expectedArray);
      assert.deepEqual(returned, expectedReturn);
    };
    arrayTest([1, 2, 3], 2, [1, 3], [2]);
    arrayTest([1, 2, 2, 3], 2, [1, 3], [2, 2]);
    arrayTest([1, 2, 3], 4, [1, 2, 3], []);
    arrayTest([1, 2, 3], <any>'a', [1, 2, 3], []);
  },

  stringify() {
    assert.equal(util.stringify('foo'), '"foo"');
    assert.equal(util.stringify(5), '5');
    assert.equal(util.stringify(/(.*)/), '"(.*)"');

    // Older versions of Firefox may inject "use strict"; into fuction
    // values
    assert.match(
      // prettier-ignore
      util.stringify(function() { return 'foo'; }),
      /"function \(\) {(?:\\n\\"use strict\\";\\n)? return 'foo'; }"/
    );

    assert.equal(util.stringify({}), '{}');
    assert.equal(util.stringify(<any>null), 'null');
    assert.equal(util.stringify(''), '""');
    assert.equal(
      util.stringify({ foo: 'bar', baz: 10 }),
      '{"foo":"bar","baz":10}'
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
