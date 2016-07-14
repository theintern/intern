define([
	'intern/dojo/node!../../SauceLabsTunnel',
	'intern!object',
	'intern/chai!assert'
], function (
	SauceLabsTunnel,
	registerSuite,
	assert
) {
	var tunnel;

	registerSuite({
		name: 'unit/SauceLabsTunnel',

		beforeEach: function() {
			tunnel = new SauceLabsTunnel();
		},

		'#auth': function () {
			tunnel.username = 'foo';
			tunnel.accessKey = 'bar';
			assert.equal(tunnel.auth, 'foo:bar');
		},

		'#executable': function () {
			tunnel.platform = 'foo';
			assert.equal(tunnel.executable, 'java');

			tunnel.platform = 'osx';
			tunnel.architecture = 'foo';
			var executable = /\.\/sc-\d+\.\d+(?:\.\d+)?-osx\/bin\/sc/;
			assert.match(tunnel.executable, executable);

			tunnel.platform = 'linux';
			assert.equal(tunnel.executable, 'java');

			tunnel.architecture = 'x64';
			executable = /\.\/sc-\d+\.\d+(?:\.\d+)?-linux\/bin\/sc/;
			assert.match(tunnel.executable, executable);

			tunnel.platform = 'win32';
			executable = /\.\/sc-\d+\.\d+(?:\.\d+)?-win32\/bin\/sc\.exe/;
			assert.match(tunnel.executable, executable);
		},

		'#extraCapabilities': function () {
			assert.deepEqual(tunnel.extraCapabilities, {});
			tunnel.tunnelId = 'foo';
			assert.deepEqual(tunnel.extraCapabilities, { 'tunnel-identifier': 'foo' });
		},

		'#isDownloaded': function () {
			tunnel.platform = 'foo';
			assert.isFalse(tunnel.isDownloaded);
		},

		'#url': function () {
			tunnel.platform = 'foo';
			tunnel.architecture = 'bar';
			assert.equal(tunnel.url, 'https://saucelabs.com/downloads/Sauce-Connect-3.1-r32.zip');

			tunnel.platform = 'darwin';
			var url = /https:\/\/saucelabs\.com\/downloads\/sc-\d+\.\d+(?:\.\d+)?-osx\.zip/;
			assert.match(tunnel.url, url);

			tunnel.platform = 'linux';
			tunnel.architecture = 'x64';
			url = /https:\/\/saucelabs\.com\/downloads\/sc-\d+\.\d+(?:\.\d+)?-linux\.tar\.gz/;
			assert.match(tunnel.url, url);
		}
	});
});
