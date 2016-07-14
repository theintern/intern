define([
	'intern/dojo/node!../../BrowserStackTunnel',
	'intern!object',
	'intern/chai!assert'
], function (
	BrowserStackTunnel,
	registerSuite,
	assert
) {
	var tunnel;

	registerSuite({
		name: 'unit/BrowserStackTunnel',

		beforeEach: function () {
			tunnel = new BrowserStackTunnel();
		},

		'#auth': function () {
			tunnel.username = 'foo';
			tunnel.accessKey = 'bar';
			assert.equal(tunnel.auth, 'foo:bar');
		},

		'#executable': function () {
			tunnel.platform = 'foo';
			var executable = './BrowserStackLocal';
			assert.equal(tunnel.executable, executable);

			tunnel.platform = 'win32';
			executable = './BrowserStackLocal.exe';
			assert.equal(tunnel.executable, executable);
		},

		'#extraCapabilities': function () {
			var capabilities = { 'browserstack.local': 'true' };
			assert.deepEqual(tunnel.extraCapabilities, capabilities);
			capabilities['browserstack.localIdentifier'] = tunnel.tunnelId = 'foo';
			assert.deepEqual(tunnel.extraCapabilities, capabilities);
		},

		'#url': function () {
			tunnel.platform = 'foo';
			assert.throws(function () {
				tunnel.url;
			});

			var url = 'https://www.browserstack.com/browserstack-local/BrowserStackLocal-';
			tunnel.platform = 'darwin';
			tunnel.architecture = 'x64';
			assert.equal(tunnel.url, url + 'darwin-x64.zip');

			tunnel.platform = 'win32';
			assert.equal(tunnel.url, url + 'win32.zip');

			tunnel.platform = 'linux';
			tunnel.architecture = 'x64';
			assert.equal(tunnel.url, url + 'linux-x64.zip');

			tunnel.architecture = 'ia32';
			assert.equal(tunnel.url, url + 'linux-ia32.zip');
		}
	});
});
