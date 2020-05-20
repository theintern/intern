import Tunnel from 'src/tunnels/Tunnel';
import SeleniumTunnel from 'src/tunnels/SeleniumTunnel';
import { Response } from 'src/common';
import { BrowserName, isWebDriver } from 'src/tunnels/types';
import { mockImport } from 'tests/support/mockUtil';
import { createSandbox } from 'sinon';

const { afterEach, suite, test } = intern.getPlugin('interface.tdd');

class MockTunnel extends Tunnel {
  _downloadFile() {
    return Promise.resolve();
  }
}

const sandbox = createSandbox();

suite('tunnels/SeleniumTunnel', () => {
  suite('config', () => {
    test('name only', () => {
      const tunnel = new SeleniumTunnel({
        drivers: [{ browserName: 'chrome' }]
      });
      assert.isFalse(tunnel.isDownloaded);
    });

    test('config object', () => {
      const tunnel = new SeleniumTunnel({
        drivers: [{ executable: 'README.md', url: '', seleniumProperty: '' }]
      });
      Object.defineProperty(tunnel, 'artifact', { value: '.' });
      Object.defineProperty(tunnel, 'directory', { value: '.' });
      assert.isTrue(tunnel.isDownloaded);
    });

    test('invalid name', () => {
      assert.throws(function() {
        const tunnel = new SeleniumTunnel({ drivers: <any>['foo'] });
        Object.defineProperty(tunnel, 'artifact', { value: '.' });
        Object.defineProperty(tunnel, 'directory', { value: '.' });
        tunnel.isDownloaded;
      }, /Invalid driver/);
    });

    test('config object with invalid name', () => {
      assert.throws(function() {
        const tunnel = new SeleniumTunnel({
          drivers: [{ browserName: 'foo' as BrowserName }]
        });
        Object.defineProperty(tunnel, 'artifact', { value: '.' });
        Object.defineProperty(tunnel, 'directory', { value: '.' });
        tunnel.isDownloaded;
      }, /Invalid driver/);
    });

    suite('debug args', () => {
      function createTest(version: string, hasDebugArg: boolean) {
        return function() {
          const tunnel = new SeleniumTunnel({
            version,
            verbose: true
          });
          console.log = () => {};
          const args = tunnel['_makeArgs']();
          console.log = oldLog;
          const indexOfDebug = args.indexOf('-debug');
          assert.notEqual(
            indexOfDebug,
            -1,
            'expected -debug arg to be present'
          );
          if (hasDebugArg) {
            assert.equal(
              args[indexOfDebug + 1],
              'true',
              "-debug should have 'true' value"
            );
          } else {
            assert.notEqual(
              args[indexOfDebug + 1],
              'true',
              "-debug should not have 'true' value"
            );
          }
        };
      }

      const oldLog = console.log;

      afterEach(() => {
        console.log = oldLog;
      });

      test('3.0.0', createTest('3.0.0', false));
      test('3.5.0', createTest('3.5.0', false));
      test('3.14.0', createTest('3.14.0', false));
      test('3.141.59', createTest('3.141.59', false));
    });
  });

  test('isWebDriver', () => {
    assert.isTrue(isWebDriver({ browserName: 'chrome' }));
    assert.isFalse(isWebDriver({ browser: 'chrome' } as any));
    assert.isFalse(isWebDriver('chrome' as any));
    assert.isFalse(isWebDriver(5 as any));
    assert.isFalse(isWebDriver(undefined as any));
  });

  suite('download webdriver data', () => {
    const mockResponse = {
      json: () => Promise.resolve({}),
      status: 200
    };
    const mockJson = sandbox.stub(mockResponse, 'json').resolves({});
    const mockStatus = sandbox.stub(mockResponse, 'status').value(200);
    const mockRequest = sandbox.spy((_url: string) =>
      Promise.resolve(mockResponse as Response)
    );

    afterEach(() => {
      sandbox.reset();
    });

    test('successful download', async () => {
      const MockedSeleniumTunnel = (
        await mockImport(
          () => import('src/tunnels/SeleniumTunnel'),
          replace => {
            replace(() => import('src/tunnels/Tunnel'))
              .transparently()
              .withDefault(MockTunnel);
            replace(() => import('src/common'))
              .transparently()
              .with({ request: mockRequest });
          }
        )
      ).default;
      const tunnel = new MockedSeleniumTunnel();

      await tunnel.download();
      assert.equal(
        mockRequest.callCount,
        1,
        'expected download to make a request'
      );
      assert.match(
        mockRequest.getCall(0).args[0],
        /theintern\.io/,
        'exected request to theintern.io'
      );
      assert.equal(
        mockJson.callCount,
        1,
        'expected response JSON to be requested'
      );
    });

    test('failed download', async () => {
      const MockedSeleniumTunnel = (
        await mockImport(
          () => import('src/tunnels/SeleniumTunnel'),
          replace => {
            replace(() => import('src/tunnels/Tunnel'))
              .transparently()
              .withDefault(MockTunnel);
            replace(() => import('src/common'))
              .transparently()
              .with({ request: mockRequest });
          }
        )
      ).default;
      const tunnel = new MockedSeleniumTunnel();
      mockStatus.value(400);

      await tunnel.download();
      assert.equal(
        mockRequest.callCount,
        1,
        'expected download to make a request'
      );
      assert.match(
        mockRequest.getCall(0).args[0],
        /theintern\.io/,
        'exected request to theintern.io'
      );
      assert.equal(
        mockJson.callCount,
        0,
        'tunnel should not have requested response JSON'
      );
    });
  });
});
