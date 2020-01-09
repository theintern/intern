import { mockImport } from 'tests/support/mockUtil';
import { createSandbox } from 'sinon';
import { parse } from 'url';

import _resolveSuites from 'src/core/lib/middleware/resolveSuites';
import { MockResponse } from 'tests/support/unit/mocks';
import {
  createMockNodeExecutor,
  createMockServer,
  createMockServerContext
} from 'tests/support/unit/mocks';

registerSuite('core/lib/middleware/resolveSuites', () => {
  let resolveSuites: typeof _resolveSuites;
  let handler: (request: any, response: any, next?: any) => any;

  const sandbox = createSandbox();
  const expandFiles = sandbox.spy((pattern?: string | string[]) => {
    return [`expanded${pattern}`];
  });
  const url = {
    parse: sandbox.spy((url: string, parseQuery: boolean) => {
      return parse(url, parseQuery);
    })
  };

  return {
    async before() {
      ({ default: resolveSuites } = await mockImport(
        () => import('src/core/lib/middleware/resolveSuites'),
        replace => {
          replace(() => import('src/core/lib/node/util')).with({ expandFiles });
          replace(() => import('url')).with({ parse: url.parse as any });
        }
      ));
    },

    beforeEach() {
      const server = createMockServer({
        executor: createMockNodeExecutor()
      });
      handler = resolveSuites(createMockServerContext(server));
      sandbox.resetHistory();
    },

    tests: {
      resolve() {
        const response = new MockResponse();
        handler(
          {
            url: 'foo?suites=bar*.js',
            intern: { executor: { log() {} } }
          },
          response
        );
        assert.deepEqual((expandFiles.args[0] as unknown) as string[][], [
          ['bar*.js']
        ]);
        assert.deepEqual(<any>response.data, '["expandedbar*.js"]');
      }
    }
  };
});
