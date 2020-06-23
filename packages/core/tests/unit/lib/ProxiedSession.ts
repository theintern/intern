import { mockImport } from 'tests/support/mockUtil';

let ProxiedSession: typeof import('src/lib/ProxiedSession').default;

class MockSession {
  _lastUrl: string | undefined;

  capabilities: { [key: string]: any } = {};

  execute() {
    return Promise.resolve();
  }

  get(url: string) {
    this._lastUrl = url;
  }
}

registerSuite('lib/ProxiedSession', {
  async before() {
    ({ default: ProxiedSession } = await mockImport(
      () => import('src/lib/ProxiedSession'),
      replace => {
        replace(() => import('@theintern/leadfoot/dist/Session')).withDefault(
          MockSession as any
        );
      }
    ));
  },

  tests: {
    '#get'() {
      const session = new ProxiedSession('foo', <any>{}, {});
      session.executor = <any>{
        config: { basePath: 'baz/', coverage: false },
        log() {}
      };
      session.baseUrl = 'bar/';

      const mockSession: MockSession = <any>session;

      // Relative URL
      session.get('testing');
      assert.equal(
        mockSession._lastUrl,
        'bar/testing',
        'expected path to be appended to base URL'
      );

      // Absolute URL
      session.get('https://foo.com/testing');
      assert.equal(
        mockSession._lastUrl,
        'https://foo.com/testing',
        'expected path to be absolute URL'
      );

      // Windows-like absolute path
      session.executor.config.basePath = 'c:/foo.com/';
      session.get('c:/foo.com/testing');
      assert.equal(
        mockSession._lastUrl,
        'bar/testing',
        'expected path to be appended to base URL'
      );
    }
  }
});
