import { mockImport } from 'tests/support/mockUtil';
import { createSandbox } from 'sinon';
import * as _util from 'src/core/lib/browser/util';

registerSuite('core/lib/browser/util', function() {
  const sandbox = createSandbox();

  let util: typeof _util;

  return {
    async before() {
      util = await mockImport(
        () => import('src/core/lib/browser/util'),
        replace => {
          replace(() => import('src/common')).with({
            global: {
              location: {
                search: ''
              }
            }
          });
        }
      );
    },

    beforeEach() {
      sandbox.resetHistory();
    },

    tests: {
      isAbsolute() {
        assert.isFalse(util.isAbsolute('foo'));
        assert.isTrue(util.isAbsolute('/foo'));
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
      },

      resolvePath() {
        assert.equal(util.resolvePath('foo'), '/foo');
        assert.equal(util.resolvePath('/foo'), '/foo');
        assert.equal(util.resolvePath('foo', '/testing/'), '/testing/foo');
      }
    }
  };
});
