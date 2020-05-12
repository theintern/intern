import { suite, test, before, beforeEach } from 'src/core/lib/interfaces/tdd';
import { mockImport } from 'tests/support/mockUtil';
import { createSandbox } from 'sinon';
import { Response } from 'src/common';

import * as _config from 'src/core/lib/browser/config';

suite('core/lib/browser/config', () => {
  const sandbox = createSandbox();

  let config: typeof _config;

  const mockResponse = {
    ok: true,
    text: sandbox.spy(() => {})
  };

  const mockRequest = sandbox.spy(() => {
    return Promise.resolve((mockResponse as unknown) as Response);
  });

  const mockDocument = { scripts: [] };
  const mockScripts = sandbox
    .stub(mockDocument, 'scripts')
    .value([{ src: 'foo' }, { src: '/bar/browser/intern.js' }]);

  const mockLocation = { pathname: '/' };
  const mockPathname = sandbox.stub(mockLocation, 'pathname').value('/');

  before(async () => {
    config = await mockImport(
      () => import('src/core/lib/browser/config'),
      replace => {
        replace(() => import('src/common')).with({
          request: mockRequest,
          global: {
            document: mockDocument,
            location: mockLocation
          }
        });
      }
    );
  });

  beforeEach(() => {
    sandbox.resetHistory();
  });

  test('createConfigurator', () => {
    const sep = '/';
    const cfg = config.createConfigurator({
      loadText: () => Promise.resolve('foo'),
      resolvePath: (file: string, base?: string) => `${base ?? sep}${file}`,
      dirname: (path: string) =>
        path
          .split(sep)
          .slice(0, -1)
          .join(sep),
      isAbsolute: () => false,
      defaultBasePath: '/',
      sep
    });
    assert.isDefined(cfg);
  });

  suite('getDefaultBasePath', () => {
    test('loaded from node_modules', () => {
      mockPathname.value('/node_modules/intern/');
      assert.equal(config.getDefaultBasePath(), '/');
    });

    test('not loaded from node_modules', () => {
      mockPathname.value('/__intern/');
      assert.equal(config.getDefaultBasePath(), '/');
    });
  });

  suite('getDefaultInternPath', () => {
    test('intern script exists', () => {
      mockScripts.value([{ src: 'foo' }, { src: '/bar/browser/intern.js' }]);
      assert.equal(config.getDefaultInternPath(), '/bar/');
    });

    test('intern script does not exist', () => {
      mockScripts.value([{ src: 'foo' }, { src: '/bar' }]);
      assert.equal(config.getDefaultInternPath(), '/');
    });
  });

  test('loadText', async () => {
    await config.loadText('foo');
    assert.equal(mockRequest.callCount, 1);
    assert.equal(mockResponse.text.callCount, 1);
  });
});
