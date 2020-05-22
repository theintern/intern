import TestingBotTunnel from '../../src/TestingBotTunnel';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');

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
