import TestingBotTunnel from 'src/tunnels/TestingBotTunnel';

registerSuite('tunnels/TestingBotTunnel', () => {
  let tunnel: TestingBotTunnel;

  return {
    beforeEach() {
      tunnel = new TestingBotTunnel();
    },

    tests: {
      '#auth'() {
        tunnel.username = 'foo';
        tunnel.accessKey = 'bar';
        assert.equal(tunnel.auth, 'foo:bar');
      }
    }
  };
});
