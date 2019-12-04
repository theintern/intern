import _ProxiedSession from 'src/core/lib/ProxiedSession';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

let ProxiedSession: typeof _ProxiedSession;
let removeMocks: () => void;

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
  before() {
    return mockRequire(require, 'src/core/lib/ProxiedSession', {
      'src/webdriver/Session': { default: MockSession }
    }).then(result => {
      removeMocks = result.remove;
      ProxiedSession = result.module.default;
    });
  },

  after() {
    removeMocks();
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
