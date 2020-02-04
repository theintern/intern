import { mockImport } from 'tests/support/mockUtil';
import { createSandbox } from 'sinon';

import * as _util from 'src/core/lib/browser/util';

registerSuite('core/lib/browser/util', function() {
  class MockResponse {
    data: string | undefined;
    ok: boolean;
    status: number;

    constructor(data?: string) {
      this.data = data;
      this.ok = data != null;
      this.status = this.ok ? 200 : 404;
    }

    text() {
      return Promise.resolve(this.data);
    }
  }

  const sandbox = createSandbox();

  const request = sandbox.spy((path: string) => {
    const data = requestData && requestData[path];
    return Promise.resolve(new MockResponse(data));
  });

  let util: typeof _util;
  let parsedArgs: { [key: string]: string | string[] };
  let requestData: { [name: string]: string };

  const mockUtil = {
    defaultConfig: 'intern.json' as 'intern.json',

    getBasePath: sandbox.spy((_path: string) => {
      return '';
    }),

    loadConfig: sandbox.spy(
      (
        filename: string,
        loadText: (filename: string) => Promise<string>,
        _args?: { [key: string]: any },
        _childConfig?: string | string[]
      ) => {
        return loadText(filename).then(text => {
          return JSON.parse(text);
        });
      }
    ),

    parseArgs: sandbox.spy(() => {
      return parsedArgs;
    }),

    splitConfigPath: sandbox.spy((path: string) => {
      const parts = path.split('@');
      return { configFile: parts[0], childConfig: parts[1] };
    })
  };

  return {
    async before() {
      util = await mockImport(
        () => import('src/core/lib/browser/util'),
        replace => {
          replace(() => import('src/common')).with({
            request: request as any,
            global: {
              location: {
                pathname: '/',
                search: ''
              }
            }
          });
          replace(() => import('src/core/lib/common/util')).with(mockUtil);
        }
      );
    },

    beforeEach() {
      parsedArgs = {};
      requestData = {};
      sandbox.resetHistory();
    },

    tests: {
      getConfig: {
        'default config': {
          exists() {
            parsedArgs.here = '1';
            parsedArgs.there = 'bar';
            const configData = { suites: ['bar.js'] };
            requestData['/intern.json'] = JSON.stringify(configData);

            return util.getConfig().then(({ config, file }) => {
              assert.strictEqual(file, '/intern.json');
              assert.equal(
                mockUtil.splitConfigPath.callCount,
                0,
                'splitConfigPath should not have been called'
              );
              assert.equal(
                mockUtil.loadConfig.callCount,
                1,
                'loadConfig should have been called'
              );
              assert.equal(
                mockUtil.parseArgs.callCount,
                1,
                'parseArgs should have been called'
              );
              assert.equal(
                request.callCount,
                1,
                'request should have been called'
              );
              assert.equal(
                mockUtil.loadConfig.getCall(0).args[0],
                '/intern.json'
              );
              assert.deepEqual(mockUtil.loadConfig.getCall(0).args[2] as {}, {
                here: '1',
                there: 'bar'
              });

              // Since we've overridden loadConfig, args shouldn't
              // actually be mixed in. The final data will have a
              // basePath of '', because the config file path
              // (used to derive the basePath) has no parent path.
              const data = { ...configData, basePath: '' };
              assert.deepEqual(config, data);
            });
          },

          'does not exist'() {
            parsedArgs.here = '1';
            parsedArgs.there = 'bar';

            return util.getConfig().then(({ config }) => {
              assert.equal(
                mockUtil.splitConfigPath.callCount,
                0,
                'splitConfigPath should not have been called'
              );
              assert.equal(
                mockUtil.loadConfig.callCount,
                1,
                'loadConfig should have been called'
              );
              assert.equal(
                mockUtil.loadConfig.getCall(0).args[0],
                '/intern.json'
              );
              assert.deepEqual(config, {
                here: '1',
                there: 'bar'
              });
            });
          },

          invalid() {
            requestData['/intern.json'] = 'foo';

            return util.getConfig().then(
              () => {
                throw new Error('getConfig should not have passed');
              },
              error => {
                if (
                  /JSON[. ]parse/i.test(error.message) ||
                  /Invalid character/i.test(error.message) ||
                  /Unexpected token/i.test(error.message)
                ) {
                  return;
                }
                throw error;
              }
            );
          }
        },

        'custom config'() {
          parsedArgs.config = 'foo.json';
          requestData['/foo.json'] = JSON.stringify({
            stuff: 'happened'
          });

          return util.getConfig().then(({ config, file }) => {
            assert.strictEqual(
              file,
              '/foo.json',
              'unexpected config file name'
            );
            assert.equal(
              mockUtil.splitConfigPath.callCount,
              1,
              'splitConfigPath should have been called'
            );
            assert.deepEqual(mockUtil.splitConfigPath.getCall(0).args, [
              'foo.json'
            ]);
            assert.equal(
              mockUtil.loadConfig.callCount,
              1,
              'loadConfig should have been called'
            );
            assert.equal(mockUtil.loadConfig.getCall(0).args[0], '/foo.json');
            assert.deepEqual(config, {
              basePath: '',
              stuff: 'happened'
            });
          });
        }
      },

      normalizePath() {
        assert.equal(util.normalizePath('/foo/bar'), '/foo/bar');
        assert.equal(util.normalizePath('/foo/.././bar'), '/bar');
        assert.equal(util.normalizePath('.././bar'), '../bar');
      },

      parseQuery() {
        const rawArgs = util.parseQuery(
          '?foo&bar=5&baz=6&baz=7&baz=foo+bar&buz='
        );
        const expected = [
          'foo',
          'bar=5',
          'baz=6',
          'baz=7',
          'baz=foo bar',
          'buz='
        ];
        assert.deepEqual(rawArgs, expected);
      },

      parseUrl() {
        const url = util.parseUrl(
          'http://www.foo.com:80/some/local/document.md?foo=bar&location=my%20house#kitchen'
        );
        assert.propertyVal(url, 'protocol', 'http');
        assert.propertyVal(url, 'hostname', 'www.foo.com');
        assert.propertyVal(url, 'port', '80');
        assert.propertyVal(url, 'path', '/some/local/document.md');
        assert.propertyVal(url, 'query', 'foo=bar&location=my%20house');
        assert.propertyVal(url, 'hash', 'kitchen');
      }
    }
  };
});
