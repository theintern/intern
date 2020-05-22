import { mockImport } from 'tests/support/mockUtil';
import { createSandbox } from 'sinon';
import * as _util from 'src/browser/lib/util';

registerSuite('browser/lib/util', function () {
  const sandbox = createSandbox();

  let util: typeof _util;

  return {
    async before() {
      util = await mockImport(
        () => import('src/browser/lib/util'),
        (replace) => {
          replace(() => import('@theintern/common')).with({
            global: {
              location: {
                search: '',
              },
            },
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
          'buz=',
        ];
        assert.deepEqual(rawArgs, expected);
      },

      resolvePath() {
        assert.equal(util.resolvePath('foo'), '/foo');
        assert.equal(util.resolvePath('/foo'), '/foo');
        assert.equal(util.resolvePath('foo', '/testing/'), '/testing/foo');
      },
    },
  };
});
