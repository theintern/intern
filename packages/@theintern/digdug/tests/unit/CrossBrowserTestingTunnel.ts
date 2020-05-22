import { join } from 'path';
import CrossBrowserTestingTunnel from '../../src/CrossBrowserTestingTunnel';

const { registerSuite } = intern.getPlugin('interface.object');
const { assert } = intern.getPlugin('chai');

registerSuite('tunnels/CrossBrowserTestingTunnel', () => {
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
        let platform = process.platform as string;
        switch (platform) {
          case 'win32':
            platform = 'win';
            break;
          case 'darwin':
            platform = 'macos';
            break;
        }
        const ext = process.platform === 'win32' ? '.exe' : '';
        const executable = `cbt_tunnel-${platform}-${process.arch}${ext}`;
        assert.equal(tunnel.executable, join(tunnel.directory, executable));
      },

      '#extraCapabilities'() {
        assert.property(tunnel.extraCapabilities, 'username');
        assert.property(tunnel.extraCapabilities, 'password');
      },
    },
  };
});
