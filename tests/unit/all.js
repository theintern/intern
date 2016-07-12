/* jshint dojo:true */
define([
	'intern/dojo/node!../../Tunnel',
	'intern/dojo/node!../../SauceLabsTunnel',
	'intern/dojo/node!../../BrowserStackTunnel',
	'intern/dojo/node!../../TestingBotTunnel',
	'intern/dojo/node!../../NullTunnel',
	'intern/dojo/node!fs',
	'intern/dojo/node!path',
	'intern!object',
	'intern/chai!assert'
], function (
	Tunnel,
	SauceLabsTunnel,
	BrowserStackTunnel,
	TestingBotTunnel,
	NullTunnel,
	fs,
	pathUtil,
	registerSuite,
	assert
) {
	var tunnel;

	registerSuite({
		name: 'digdug',

		afterEach: function () {
			tunnel = null;
		},

		'SauceLabsTunnel': (function () {
			return {
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
			};
		})(),

		'BrowserStackTunnel': (function () {
			return {
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
			};
		})(),

		'TestingBotTunnel': (function () {
			return {
				beforeEach: function () {
					tunnel = new TestingBotTunnel();
				},

				'#auth': function () {
					tunnel.apiKey = 'foo';
					tunnel.apiSecret = 'bar';
					assert.equal(tunnel.auth, 'foo:bar');
				}
			};
		})(),

		'Tunnel': (function () {
			return {
				beforeEach: function () {
					tunnel = new Tunnel({ foo: 'bar' });
				},

				'#clientUrl': function () {
					tunnel.port = 4446;
					tunnel.hostname = 'foo.com';
					tunnel.protocol = 'https';
					tunnel.pathname = 'bar/baz/';
					assert.strictEqual(tunnel.clientUrl, 'https://foo.com:4446/bar/baz/');
				},

				'#extraCapabilities': function () {
					assert.deepEqual(tunnel.extraCapabilities, {});
				},

				'#start': function () {
					try {
						tunnel.isRunning = true;
						assert.throws(function () {
							tunnel.start();
						});
						tunnel.isRunning = false;

						tunnel.isStopping = true;
						assert.throws(function () {
							tunnel.start();
						});
						tunnel.isStopping = false;
					}
					finally {
						tunnel.isRunning = false;
						tunnel.isStoppping = false;
						tunnel.isStarting = false;
					}
				},

				'#stop': function () {
					try {
						tunnel.isStopping = true;
						assert.throws(function () {
							tunnel.stop();
						});
						tunnel.isStopping = false;

						tunnel.isStarting = true;
						assert.throws(function () {
							tunnel.stop();
						});
						tunnel.isStarting = false;

						tunnel.isRunning = false;
						assert.throws(function () {
							tunnel.stop();
						});
						tunnel.isRunning = true;
					}
					finally {
						tunnel.isStopping = false;
						tunnel.isStarting = false;
						tunnel.isRunning = false;
					}
				},

				'#sendJobState': function () {
					var dfd = this.async();
					tunnel.sendJobState().catch(function () {
						dfd.resolve();
					});
				}
			};
		})()
	});
});
