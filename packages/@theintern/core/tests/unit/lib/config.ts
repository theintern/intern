import { mockImport } from 'tests/support/mockUtil';
import { createSandbox } from 'sinon';
import { duplicate } from '@theintern/common';
import { FileConfig } from 'src/lib/config';

const { suite, test, before, beforeEach } = intern.getPlugin('interface.tdd');

import * as _config from 'src/lib/config';

suite('lib/config', () => {
  let config: typeof _config;
  const sandbox = createSandbox();

  before(async () => {
    config = await mockImport(
      () => import('src/lib/config'),
      (replace) => {
        replace(() => import('@theintern/common')).with({
          duplicate,
        });
      }
    );
  });

  test('parseArgs', () => {
    const args = config.parseArgs([
      'debug',
      'serverPort=5',
      'suites=6',
      'suites=7',
      'suites=8',
      'coverage=8f5=324',
      'functionalSuites=',
      'node.foo=42',
    ]);
    const expected = {
      debug: true,
      serverPort: '5',
      suites: ['6', '7', '8'],
      coverage: '8f5=324',
      functionalSuites: '',
      node: { foo: '42' },
    };
    assert.propertyVal(
      args,
      'debug',
      expected.debug,
      'bare arg should be parsed as boolean true'
    );
    assert.propertyVal(
      args,
      'serverPort',
      expected.serverPort,
      'assigned value should be a string'
    );
    assert.property(
      args,
      'suites',
      'multiply-assigned value should be in args'
    );
    assert.deepEqual(
      args.suites,
      expected.suites,
      'multiply-assigned value should be an array of strings'
    );
    assert.property(args, 'coverage', 'arg value containing "=" should exist');
    assert.property(
      args,
      'functionalSuites',
      'arg value containing "=" with no value should exist'
    );
    assert.deepEqual(
      args.node,
      expected.node,
      'dot-separated key should assign to nested objects'
    );
    assert.deepEqual(args, expected);
  });

  suite('createConfig', () => {
    const expectedDefault = {
      basePath: '',
      bail: false,
      baseline: false,
      benchmark: false,
      browser: {},
      capabilities: {},
      connectTimeout: 30000,
      coverage: [],
      coverageVariable: '__coverage__',
      debug: false,
      defaultTimeout: 30000,
      description: '',
      environments: [{ browserName: 'node' as const }],
      filterErrorStack: false,
      functionalCoverage: false,
      functionalRetries: 0,
      functionalSuites: [],
      functionalTimeouts: {},
      grep: new RegExp(''),
      heartbeatInterval: 60,
      instrumenterOptions: {},
      internPath: '.',
      leaveRemoteOpen: false,
      loader: { script: 'default' },
      maxConcurrency: Infinity,
      name: 'intern',
      node: {},
      plugins: [],
      remoteOptions: {},
      reporters: [],
      runInSync: false,
      serveOnly: false,
      serverPort: 9000,
      serverUrl: '',
      socketPort: 9001,
      sessionId: '',
      suites: <string[]>[],
      tunnel: 'selenium',
      tunnelOptions: { tunnelId: String(Date.now()) },
      warnOnUncaughtException: false,
      warnOnUnhandledRejection: false,
    };

    test('default', () => {
      const cfg = config.createConfig();
      assert.deepEqualExcluding(cfg, expectedDefault, 'tunnelOptions');
      assert.deepEqualExcluding(
        cfg.tunnelOptions,
        expectedDefault.tunnelOptions,
        'tunnelId'
      );
    });

    test('with options', () => {
      const cfg = config.createConfig({
        basePath: 'foo',
        socketPort: 4,
      });
      const expected = {
        ...expectedDefault,
        basePath: 'foo',
        socketPort: 4,
      };
      assert.deepEqualExcluding(cfg, expected, 'tunnelOptions');
      assert.deepEqualExcluding(
        cfg.tunnelOptions,
        expected.tunnelOptions,
        'tunnelId'
      );
    });
  });

  test('createConfigurator', () => {
    const sep = '/';
    const cfg = config.createConfigurator({
      loadText: () => Promise.resolve('foo'),
      resolvePath: (file: string, base?: string) => `${base ?? sep}${file}`,
      dirname: (path: string) => path.split(sep).slice(0, -1).join(sep),
      isAbsolute: () => false,
      defaultBasePath: '/',
      sep,
    });
    assert.isDefined(cfg);
  });

  suite('Configurator', () => {
    suite('addToConfig', () => {
      const emitter = sandbox.stub().resolves();
      const sep = '/';
      let configurator: _config.Configurator;

      function testProperty<K extends keyof _config.Config>(
        name: K,
        badValue: any,
        goodValue: _config.ArgType,
        expectedValue: _config.Config[K],
        error: RegExp,
        allowDeprecated?: boolean | string,
        message?: string
      ) {
        if (typeof allowDeprecated === 'string') {
          message = allowDeprecated;
          allowDeprecated = undefined;
        }
        if (typeof allowDeprecated === 'undefined') {
          allowDeprecated = false;
        }

        assert.throws(() => {
          configurator.addToConfig({ [name]: badValue });
        }, error);
        const cfg = configurator.addToConfig({ [name]: goodValue });

        if (allowDeprecated) {
          for (const call of emitter.getCalls()) {
            assert.include(
              call.args[0],
              'deprecated',
              'no warning should have been emitted'
            );
          }
        } else {
          assert.equal(
            emitter.callCount,
            0,
            'no warning should have been emitted'
          );
        }

        // name = name.replace(/\+$/, '') as keyof _config.Config;
        if (typeof expectedValue === 'object') {
          assert.deepEqual(cfg[name], expectedValue, message);
        } else {
          assert.strictEqual(cfg[name], expectedValue, message);
        }
      }

      function additiveTest<K extends keyof _config.Config>(
        name: K,
        initial: _config.Config[K],
        extra: _config.Config[K]
      ) {
        return () => {
          const cfg = configurator.addToConfig({
            [name]: extra,
          });
          assert.deepEqual(cfg[name], extra);

          configurator.addToConfig({ [name]: initial }, cfg);
          assert.deepEqual(cfg[name], initial);

          configurator.addToConfig({ [`${name}+`]: extra }, cfg);
          let expected: _config.Config[K];
          if (Array.isArray(initial)) {
            expected = [...initial, ...(extra as any)] as any;
          } else {
            expected = { ...(initial as any), ...(extra as any) };
          }

          assert.deepEqual(cfg[name], expected);
        };
      }

      function nonAdditiveTest<K extends keyof _config.Config>(name: K) {
        return () => {
          assert.throws(
            () => configurator.addToConfig({ [`${name}+`]: null }),
            'cannot be extended'
          );
        };
      }

      function booleanTest(name: keyof _config.Config) {
        return () => {
          testProperty(name, 5, 'true', true, /Non-boolean/);
        };
      }

      function stringTest(name: keyof _config.Config) {
        return () => {
          testProperty(name, 5, 'foo', 'foo', /Non-string/);
        };
      }

      function basePathTest(name: keyof _config.Config) {
        return () => {
          testProperty(name, 5, 'foo', 'foo/', /Non-string/);
        };
      }

      function numberTest(name: keyof _config.Config) {
        return () => {
          testProperty(name, 'foo', '5', 5, /Non-numeric/);
          testProperty(name, 'foo', 5, 5, /Non-numeric/);
        };
      }

      function regexpTest(name: keyof _config.Config) {
        return () => {
          testProperty(name, 5, 'foo', /foo/, /Non-regexp/);
        };
      }

      function stringArrayTest(name: keyof _config.Config) {
        return () => {
          testProperty(name, 5, 'foo', ['foo'], /Non-string/);
        };
      }

      function simpleValueSuite<K extends keyof _config.Config>(
        name: K,
        typeTest: (name: K) => () => void
      ) {
        return () => {
          test('value', typeTest(name));
          test('non-additive', nonAdditiveTest(name));
        };
      }

      before(() => {
        configurator = config.createConfigurator({
          loadText: () => Promise.resolve('foo'),
          resolvePath: (file: string, base?: string) => `${base ?? sep}${file}`,
          dirname: (path: string) => path.split(sep).slice(0, -1).join(sep),
          isAbsolute: () => false,
          defaultBasePath: '/',
          sep,
          eventEmitter: {
            emit: emitter,
          },
        });
      });

      suite('bail', simpleValueSuite('bail', booleanTest));
      suite('baseline', simpleValueSuite('baseline', booleanTest));
      suite('basePath', simpleValueSuite('basePath', basePathTest));
      suite('benchmark', simpleValueSuite('benchmark', booleanTest));

      suite('benchmarkConfig', () => {
        test('normal', () => {
          testProperty(
            'benchmarkConfig',
            5,
            { id: 'foo' },
            { id: 'foo' },
            /Non-object/
          );
        });

        test(
          'additive',
          additiveTest(
            'benchmarkConfig',
            { id: 'foo', filename: 'bar' },
            { id: 'baz' }
          )
        );
      });

      suite('browser', () => {
        test('normal', () => {
          testProperty(
            'browser',
            5,
            { suites: 'foo' },
            { suites: ['foo'] },
            /Non-object/
          );
        });

        test(
          'additive',
          additiveTest(
            'browser',
            { plugins: [{ script: 'foo' }] },
            { suites: ['bar'] }
          )
        );
      });

      suite('capabilities', () => {
        test('normal', () => {
          testProperty(
            'capabilities',
            5,
            { id: 'foo' },
            { id: 'foo' },
            /Non-object/
          );
        });

        test(
          'additive',
          additiveTest('capabilities', { foo: 'bar' }, { bar: 3 })
        );
      });

      suite('connectTimeout', simpleValueSuite('connectTimeout', numberTest));

      suite('coverage', () => {
        test('value', stringArrayTest('coverage'));
        test('additive', additiveTest('coverage', ['foo'], ['bar']));
      });

      suite(
        'coverageVariable',
        simpleValueSuite('coverageVariable', nonAdditiveTest)
      );
      suite('debug', simpleValueSuite('debug', booleanTest));
      suite('defaultTimeout', simpleValueSuite('defaultTimeout', numberTest));
      suite('description', simpleValueSuite('description', stringTest));

      suite('environments', () => {
        test('normal', () => {
          testProperty(
            'environments',
            5,
            'chrome',
            [{ browserName: 'chrome' }],
            /Non-object/
          );
          testProperty(
            'environments',
            { name: 'chrome' },
            'chrome',
            [{ browserName: 'chrome' }],
            /Invalid value.*missing/
          );
          testProperty('environments', 5, '', [], /Non-object/);
        });

        test('additive', () => {
          const cfg = configurator.addToConfig({
            environments: ['chrome'],
          });
          configurator.addToConfig({ 'environments+': 'firefox' }, cfg);
          assert.deepEqual(cfg.environments, [
            { browserName: 'chrome' },
            { browserName: 'firefox' },
          ]);
        });
      });

      suite(
        'filterErrorStack',
        simpleValueSuite('filterErrorStack', booleanTest)
      );
      suite(
        'functionalBaseUrl',
        simpleValueSuite('functionalBaseUrl', basePathTest)
      );
      suite(
        'functionalCoverage',
        simpleValueSuite('functionalCoverage', booleanTest)
      );
      suite(
        'functionalRetries',
        simpleValueSuite('functionalRetries', numberTest)
      );

      suite('functionalSuites', () => {
        test('normal', stringArrayTest('functionalSuites'));
        test('additive', additiveTest('functionalSuites', ['foo'], ['bar']));
      });

      suite('functionalTimeouts', () => {
        test('normal', () => {
          testProperty(
            'functionalTimeouts',
            5,
            { pageLoad: 5 },
            { pageLoad: 5 },
            /Non-object/
          );
          testProperty(
            'functionalTimeouts',
            { foo: 'bar' },
            { pageLoad: 5 },
            { pageLoad: 5 },
            /Non-numeric/
          );
        });

        test(
          'additive',
          additiveTest(
            'functionalTimeouts',
            { find: 1000 },
            { executeAsync: 20000 }
          )
        );
      });

      suite('grep', simpleValueSuite('grep', regexpTest));
      suite(
        'heartbeatInterval',
        simpleValueSuite('heartbeatInterval', numberTest)
      );

      suite('instrumenterOptions', () => {
        test('basic', () => {
          testProperty(
            'instrumenterOptions',
            5,
            { foo: 'bar' },
            { foo: 'bar' },
            /Non-object/
          );
        });

        test(
          'additive',
          additiveTest('instrumenterOptions', { foo: 'bar' }, { bar: 3 })
        );
      });

      suite('internPath', simpleValueSuite('internPath', basePathTest));

      suite('leaveRemoteOpen', () => {
        test('value', () => {
          testProperty(
            'leaveRemoteOpen',
            'foo',
            'fail',
            'fail',
            /Invalid value/
          );
          testProperty('leaveRemoteOpen', 'foo', 'true', true, /Invalid value/);
        });
        test('non-additive', nonAdditiveTest('leaveRemoteOpen'));
      });

      suite('maxConcurrency', simpleValueSuite('maxConcurrency', numberTest));
      suite('name', simpleValueSuite('name', stringTest));

      suite('node', () => {
        test('normal', () => {
          testProperty(
            'node',
            5,
            { suites: 'foo' },
            { suites: ['foo'] },
            /Non-object/
          );
        });

        test(
          'additive',
          additiveTest(
            'node',
            { plugins: [{ script: 'foo' }] },
            { suites: ['bar'] }
          )
        );
      });

      suite('proxy', simpleValueSuite('proxy', stringTest));

      test('remoteOptions', () => {
        testProperty(
          'remoteOptions',
          5,
          { disableDomUpdates: false },
          { disableDomUpdates: false },
          /Non-object/
        );
      });

      suite('reporters', () => {
        test('normal', () => {
          testProperty(
            'reporters',
            5,
            'html',
            [{ name: 'html' }],
            /Non-object/
          );
          testProperty(
            'reporters',
            { foo: 'html' },
            'html',
            [{ name: 'html' }],
            /Invalid value.*missing/
          );
          testProperty('environments', 5, '', [], /Non-object/);
        });

        test('additive', () => {
          const cfg = configurator.addToConfig({
            reporters: ['html'],
          });
          configurator.addToConfig({ 'reporters+': 'runner' }, cfg);
          assert.deepEqual(cfg.reporters, [
            { name: 'html' },
            { name: 'runner' },
          ]);
        });
      });

      suite('runInSync', simpleValueSuite('runInSync', booleanTest));
      suite('serveOnly', simpleValueSuite('serveOnly', booleanTest));
      suite('serverPort', simpleValueSuite('serverPort', numberTest));
      suite('serverUrl', simpleValueSuite('serverUrl', basePathTest));
      suite('sessionId', simpleValueSuite('sessionId', stringTest));
      suite('socketPort', simpleValueSuite('socketPort', numberTest));

      suite('suites', () => {
        test('normal', stringArrayTest('suites'));
        test('additive', additiveTest('suites', ['foo'], ['bar']));
      });

      suite('tunnel', simpleValueSuite('tunnel', stringTest));

      suite('tunnelOptions', () => {
        test('normal', () => {
          testProperty(
            'tunnelOptions',
            5,
            { drivers: ['chrome'] },
            { drivers: [{ browserName: 'chrome' }] },
            /Non-object/
          );
        });

        test(
          'additive',
          additiveTest(
            'tunnelOptions',
            { drivers: [{ browserName: 'chrome' }] },
            { verbose: true }
          )
        );
      });

      suite('warnOnUncaughtException', () => {
        test('boolean', () => {
          testProperty('warnOnUncaughtException', 5, true, true, /Non-regexp/);
        });
        test('regexp', () => {
          testProperty(
            'warnOnUncaughtException',
            5,
            'foo',
            /foo/,
            /Non-regexp/
          );
        });
        test('non-additive', nonAdditiveTest('warnOnUncaughtException'));
      });

      suite('warnOnUnhandledRejection', () => {
        test('boolean', () => {
          testProperty('warnOnUnhandledRejection', 5, true, true, /Non-regexp/);
        });
        test('regexp', () => {
          testProperty(
            'warnOnUnhandledRejection',
            5,
            'foo',
            /foo/,
            /Non-regexp/
          );
        });
        test('non-additive', nonAdditiveTest('warnOnUnhandledRejection'));
      });
    });

    suite('describeConfig', () => {
      let testConfig: Partial<_config.FileConfig>;
      let configurator: _config.Configurator;
      const cfgFile = 'intern-foo.json';

      beforeEach(() => {
        const sep = '/';
        configurator = config.createConfigurator({
          loadText: (path: string) => {
            assert.equal(path, cfgFile);
            return Promise.resolve(JSON.stringify(testConfig));
          },
          resolvePath: (file: string, base?: string) => `${base ?? sep}${file}`,
          dirname: (path: string) => path.split(sep).slice(0, -1).join(sep),
          isAbsolute: () => false,
          defaultBasePath: '/',
          sep,
        });
      });

      test('simple', async () => {
        testConfig = { description: 'Test config' };
        const description = await configurator.describeConfig(cfgFile);
        const expected = 'Test config';
        assert.equal(description, expected);
      });

      test('child configs', async () => {
        testConfig = {
          description: 'Test config',
          configs: {
            foo: {
              description: 'Child config',
            },
          },
        };
        const description = await configurator.describeConfig(cfgFile);
        const expected = 'Test config\n\nConfigs:\n  foo (Child config)';
        assert.equal(description, expected);
      });

      test('prefix', async () => {
        testConfig = {
          description: 'Test config',
          configs: {
            foo: {
              description: 'Child config',
            },
          },
        };
        const description = await configurator.describeConfig(cfgFile, '  ');
        const expected = '  Test config\n\n  Configs:\n    foo (Child config)';
        assert.equal(description, expected);
      });
    });

    suite('loadConfig', () => {
      let configFiles: { [name: string]: string } = {};
      const defaultSep = '/';

      const loadText = sandbox.spy((path: string) => {
        if (!(path in configFiles)) {
          return Promise.reject(new Error(`File ${path} not found`));
        }
        return Promise.resolve(configFiles[path]);
      });

      const createConfigurator = (sep = defaultSep) =>
        config.createConfigurator({
          loadText,
          resolvePath: (file: string, base?: string) => `${base ?? ''}${file}`,
          dirname: (path: string) => path.split(sep).slice(0, -1).join(sep),
          isAbsolute: () => false,
          defaultBasePath: '',
          sep,
        });

      beforeEach(() => {
        sandbox.resetHistory();
        configFiles = {};
      });

      test('default', async () => {
        const cfgFile = _config.DEFAULT_CONFIG;
        configFiles[cfgFile] = '{}';
        const configurator = createConfigurator();
        const cfg = await configurator.loadConfig();
        assert.equal(
          loadText.callCount,
          1,
          'expected loadText to be called once'
        );
        assert.deepEqual(
          cfg,
          { basePath: '' } as Partial<_config.Config>,
          'expected loaded config to equal test config'
        );
      });

      test('missing file', async () => {
        const cfgFile = './foo.json';
        configFiles[cfgFile] = JSON.stringify({ suites: ['foo'] });
        try {
          const configurator = createConfigurator();
          await configurator.loadConfig('other.json');
          assert.fail('expected load to fail');
        } catch (error) {
          if (error.name === 'AssertionError') {
            throw error;
          }
        }
      });

      test('config file', async () => {
        const testConfig: FileConfig = { suites: ['foo'] };
        const cfgFile = './foo.json';
        configFiles[cfgFile] = JSON.stringify(testConfig);
        const configurator = createConfigurator();
        const cfg = await configurator.loadConfig(cfgFile);
        assert.equal(
          loadText.callCount,
          1,
          'expected loadText to be called once'
        );
        assert.deepEqual(
          cfg,
          {
            ...testConfig,
            basePath: './',
          } as Partial<_config.Config>,
          'expected loaded config to equal test config'
        );
      });

      test('config name', async () => {
        const testConfig: FileConfig = {
          suites: ['foo'],
          configs: { wd: { suites: ['other'] } },
        };
        const cfgFile = _config.DEFAULT_CONFIG;
        configFiles[cfgFile] = JSON.stringify(testConfig);
        const configurator = createConfigurator();
        const cfg = await configurator.loadConfig('@wd');
        assert.equal(
          loadText.callCount,
          1,
          'expected loadText to be called once'
        );
        assert.deepEqual(
          cfg,
          {
            basePath: '',
            suites: testConfig?.configs?.wd.suites,
          } as Partial<_config.Config>,
          'expected loaded config to equal test config'
        );
      });

      test('file with config name', async () => {
        const testConfig: FileConfig = {
          suites: ['foo'],
          configs: { wd: { suites: ['other'] } },
        };
        const cfgFile = 'foo.json';
        configFiles[cfgFile] = JSON.stringify(testConfig);
        const configurator = createConfigurator();
        const cfg = await configurator.loadConfig(`${cfgFile}@wd`);
        assert.equal(
          loadText.callCount,
          1,
          'expected loadText to be called once'
        );
        assert.deepEqual(
          cfg,
          {
            basePath: '',
            suites: testConfig?.configs?.wd.suites,
          } as Partial<_config.Config>,
          'expected loaded config to equal test config'
        );
      });

      test('extended config with property merging', async () => {
        const testConfig: FileConfig = {
          extends: 'bar.json',
          suites: ['foo'],
          'functionalSuites+': ['foo'],
        };
        const extendedConfig = {
          suites: ['baz'],
          functionalSuites: ['baz'],
          name: 'baz',
        };
        const cfgFile = 'foo.json';
        configFiles[cfgFile] = JSON.stringify(testConfig);
        configFiles[testConfig.extends!] = JSON.stringify(extendedConfig);
        const configurator = createConfigurator();
        const cfg = await configurator.loadConfig(cfgFile);
        assert.equal(
          loadText.callCount,
          2,
          'expected loadText to be called for the base and extended configs'
        );
        assert.deepEqual(cfg, {
          basePath: '',
          suites: testConfig.suites,
          functionalSuites: [
            ...extendedConfig.suites,
            ...(testConfig.suites as string[]),
          ],
          name: extendedConfig.name,
        } as Partial<_config.Config>);
      });

      test('extended child config', async () => {
        const testConfig: FileConfig = {
          suites: ['foo'],
          configs: {
            ci: { functionalSuites: ['bar'] },
            wd: { extends: 'ci', suites: ['baz'] },
          },
        };
        configFiles[_config.DEFAULT_CONFIG] = JSON.stringify(testConfig);
        const configurator = createConfigurator();
        const cfg = await configurator.loadConfig('@wd');
        assert.equal(
          loadText.callCount,
          1,
          'expected loadText to be called once'
        );
        assert.deepEqual(
          cfg,
          {
            basePath: '',
            functionalSuites: ['bar'],
            suites: ['baz'],
          } as Partial<_config.Config>,
          'expected loaded config to equal test config'
        );
      });

      test('extended child config with property merging', async () => {
        const testConfig: FileConfig = {
          suites: ['foo'],
          functionalSuites: ['bif'],
          plugins: ['grault'],
          configs: {
            ci: {
              functionalSuites: ['bar'],
              'suites+': ['quip'],
              'plugins+': ['quuz'],
            },
            wd: {
              extends: 'ci',
              'functionalSuites+': ['qux'],
              'suites+': ['baz'],
              plugins: ['corge'],
            },
          },
        };
        configFiles[_config.DEFAULT_CONFIG] = JSON.stringify(testConfig);
        const configurator = createConfigurator();
        const cfg = await configurator.loadConfig('@wd');
        assert.equal(
          loadText.callCount,
          1,
          'expected loadText to be called once'
        );
        assert.deepEqual(
          cfg,
          {
            basePath: '',
            // functionalSuites will merge one level down and then overwrite the
            // base
            functionalSuites: ['bar', 'qux'],
            // suites will merge at both levels
            suites: ['foo', 'quip', 'baz'],
            // wd's plugins will override ci's and the base's
            plugins: [{ script: 'corge' }],
          } as Partial<_config.Config>,
          'expected loaded config to equal test config'
        );
      });

      test('extended child config with multiple parents', async () => {
        const testConfig: FileConfig = {
          suites: ['foo'],
          configs: {
            ci: { functionalSuites: ['bar'], suites: ['quip'] },
            bs: { tunnel: 'bs' },
            wd: { extends: ['ci', 'bs'], suites: ['baz'] },
          },
        };
        configFiles[_config.DEFAULT_CONFIG] = JSON.stringify(testConfig);
        const configurator = createConfigurator();
        const cfg = await configurator.loadConfig('@wd');
        assert.equal(
          loadText.callCount,
          1,
          'expected loadText to be called once'
        );
        assert.deepEqual(
          cfg,
          {
            basePath: '',
            functionalSuites: ['bar'],
            suites: ['baz'],
            tunnel: 'bs',
          } as Partial<_config.Config>,
          'expected loaded config to equal test config'
        );
      });

      suite('basePath', () => {
        test('POSIX path', async () => {
          const testConfig: FileConfig = { suites: ['foo'] };
          const cfgFile = '/home/user/project/test/foo.json';
          configFiles[cfgFile] = JSON.stringify(testConfig);
          const configurator = createConfigurator();
          const cfg = await configurator.loadConfig(cfgFile);
          assert.propertyVal(cfg, 'basePath', '/home/user/project/test/');
        });

        test('windows path', async () => {
          const testConfig: FileConfig = { suites: ['foo'] };
          const cfgFile = 'C:\\home\\user\\project\\test\\foo.json';
          configFiles[cfgFile] = JSON.stringify(testConfig);
          const configurator = createConfigurator('\\');
          const cfg = await configurator.loadConfig(cfgFile);
          assert.propertyVal(
            cfg,
            'basePath',
            'C:\\home\\user\\project\\test\\'
          );
        });

        test('from config', async () => {
          const testConfig: FileConfig = { basePath: '/foo' };
          const cfgFile = '/home/user/project/test/foo.json';
          configFiles[cfgFile] = JSON.stringify(testConfig);
          const configurator = createConfigurator();
          const cfg = await configurator.loadConfig(cfgFile);
          assert.propertyVal(cfg, 'basePath', '/foo/');
        });
      });

      suite('config JSON', () => {
        test('simple JSON', async () => {
          const testConfig: FileConfig = { basePath: '/bar' };
          const cfgFile = '/home/user/project/test/foo.json';
          configFiles[cfgFile] = JSON.stringify(testConfig);
          const configurator = createConfigurator();
          const cfg = await configurator.loadConfig(cfgFile);
          assert.deepEqual(cfg, { basePath: '/bar/' });
        });

        test('JSON with line comment', async () => {
          const cfgFile = '/home/user/project/test/foo.json';
          configFiles[cfgFile] = `{
            // set a basePath
            "basePath": "/bar"
          }`;
          const configurator = createConfigurator();
          const cfg = await configurator.loadConfig(cfgFile);
          assert.deepEqual(cfg, { basePath: '/bar/' });
        });

        test('JSON with block comment', async () => {
          const cfgFile = '/home/user/project/test/foo.json';
          configFiles[cfgFile] = `{
            /*
             * set a basePath
             */
            "basePath": "/bar"
          }`;
          const configurator = createConfigurator();
          const cfg = await configurator.loadConfig(cfgFile);
          assert.deepEqual(cfg, { basePath: '/bar/' });
        });

        test('invalid JSON', async () => {
          const cfgFile = '/home/user/project/test/foo.json';
          configFiles[cfgFile] = `{
            // set a basePath
            basePath: /bar"
          }`;
          const configurator = createConfigurator();

          let error: Error | undefined;
          try {
            await configurator.loadConfig(cfgFile);
          } catch (err) {
            assert.equal(err.name, 'ParseError');
            error = err;
          }

          assert.isDefined(error, 'Expected error to be thrown');
        });
      });
    });
  });
});
