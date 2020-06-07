import CrossBrowserTestingTunnel from '../../src/CrossBrowserTestingTunnel';

registerSuite('unit/CrossBrowserTestingTunnel', () => {
  let tunnel: CrossBrowserTestingTunnel;

  return {
    beforeEach() {
      tunnel = new CrossBrowserTestingTunnel();
    },

    tests: {
      '#auth'() {
        tunnel.username = 'foo';
        tunnel.accessKey = 'bar';
        assert.equal(tunnel.auth, 'foo:bar');
      },

      '#executable'() {
        assert.equal(tunnel.executable, 'node');
      },

      '#extraCapabilities'() {
        assert.property(tunnel.extraCapabilities, 'username');
        assert.property(tunnel.extraCapabilities, 'password');
      }
    }
  };
});
