import SauceLabsTunnel from 'src/tunnels/SauceLabsTunnel';

registerSuite('unit/SauceLabsTunnel', () => {
  let tunnel: SauceLabsTunnel;

  return {
    beforeEach() {
      tunnel = new SauceLabsTunnel();
    },

    tests: {
      '#auth'() {
        tunnel.username = 'foo';
        tunnel.accessKey = 'bar';
        assert.equal(tunnel.auth, 'foo:bar');
      },

      '#executable'() {
        tunnel.platform = 'foo';
        assert.equal(tunnel.executable, 'java');

        tunnel.platform = 'osx';
        tunnel.architecture = 'foo';
        let executable = /\/sc-\d+\.\d+(?:\.\d+)?-osx\/bin\/sc$/;
        assert.match(tunnel.executable, executable);

        tunnel.platform = 'linux';
        assert.equal(tunnel.executable, 'java');

        tunnel.architecture = 'x64';
        executable = /\/sc-\d+\.\d+(?:\.\d+)?-linux\/bin\/sc$/;
        assert.match(tunnel.executable, executable);

        tunnel.platform = 'win32';
        executable = /\/sc-\d+\.\d+(?:\.\d+)?-win32\/bin\/sc\.exe$/;
        assert.match(tunnel.executable, executable);
      },

      '#extraCapabilities'() {
        assert.deepEqual(tunnel.extraCapabilities, {});
        tunnel.tunnelId = 'foo';
        assert.deepEqual(tunnel.extraCapabilities, {
          'tunnel-identifier': 'foo'
        });
      },

      '#isDownloaded'() {
        tunnel.platform = 'foo';
        assert.isFalse(tunnel.isDownloaded);
      },

      '#url'() {
        tunnel.platform = 'foo';
        tunnel.architecture = 'bar';
        assert.equal(
          tunnel.url,
          'https://saucelabs.com/downloads/Sauce-Connect-3.1-r32.zip'
        );

        tunnel.platform = 'darwin';
        let url = /https:\/\/saucelabs\.com\/downloads\/sc-\d+\.\d+(?:\.\d+)?-osx\.zip/;
        assert.match(tunnel.url, url);

        tunnel.platform = 'linux';
        tunnel.architecture = 'x64';
        url = /https:\/\/saucelabs\.com\/downloads\/sc-\d+\.\d+(?:\.\d+)?-linux\.tar\.gz/;
        assert.match(tunnel.url, url);
      }
    }
  };
});
