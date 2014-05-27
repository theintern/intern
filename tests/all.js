/* jshint dojo:true */
define([
	'dojo/node!../Tunnel',
	'dojo/node!../SauceLabsTunnel',
	'dojo/node!../BrowserStackTunnel',
	'dojo/node!../TestingBotTunnel',
	'dojo/node!../NullTunnel',
	'dojo/node!fs',
	'dojo/node!path',
	'intern!object',
	'intern/chai!assert',
	'intern/lib/args'
], function (
	Tunnel,
	SauceLabsTunnel,
	BrowserStackTunnel,
	TestingBotTunnel,
	NullTunnel,
	fs,
	pathUtil,
	registerSuite,
	assert,
	args
) {
	function cleanup(tunnel) {
		if (args.noClean) {
			return;
		}

		function deleteRecursive(dir) {
			var files = [];
			if (fs.existsSync(dir)) {
				files = fs.readdirSync(dir);
				files.forEach(function(file) {
					var path = pathUtil.join(dir, file);
					if (fs.lstatSync(path).isDirectory()) {
						deleteRecursive(path);
					}
					else {
						fs.unlinkSync(path);
					}
				});
				fs.rmdirSync(dir);
			}
		}

		deleteRecursive(tunnel.directory);
	}

	function tunnelTest(dfd, tunnel, check) {
		cleanup(tunnel);

		if (args.showStdout) {
			tunnel.on('stdout', console.log);
			tunnel.on('stderr', console.log);
		}

		tunnel.start().then(function () {
			dfd.resolve();
		}).catch(function (error) {
			if (check(error)) {
				dfd.resolve();
			}
			else {
				dfd.reject(error);
			}
		});
	}

	var tunnel;

	registerSuite({
		name: 'digdug',

		afterEach: function () {
			if (tunnel.isRunning) {
				tunnel.stop();
			}
			cleanup(tunnel);
			tunnel = null;
		},

		'SauceLabsTunnel': (function () {
			return {
				beforeEach: function() {
					tunnel = new SauceLabsTunnel();
				},

				'#start': function() {
					tunnelTest(this.async(), tunnel, function (error) {
						return /Not authorized/.test(error.message);
					});
				},

				'#clientAuth': function () {
					tunnel.username = 'foo';
					tunnel.accessKey = 'bar';
					assert.equal(tunnel.clientAuth, 'foo:bar');
				},

				'#executable': function () {
					tunnel.platform = 'foo';
					assert.equal(tunnel.executable, 'java');

					tunnel.platform = 'osx';
					tunnel.architecture = 'foo';
					var version = tunnel.sauceConnectVersion;
					var executable = './sc-' + version + '-osx/bin/sc';
					assert.equal(tunnel.executable, executable);

					tunnel.platform = 'linux';
					assert.equal(tunnel.executable, 'java');

					tunnel.architecture = 'x64';
					executable = './sc-' + version + '-linux/bin/sc';
					assert.equal(tunnel.executable, executable);

					tunnel.platform = 'win32';
					executable = './sc-' + version + '-win32/bin/sc.exe';
					assert.equal(tunnel.executable, executable);
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
					var version = tunnel.sauceConnectVersion;
					var url = 'https://d2nkw87yt5k0to.cloudfront.net/downloads/sc-' + version + '-osx.zip';
					assert.equal(tunnel.url, url);

					tunnel.platform = 'linux';
					tunnel.architecture = 'x64';
					url = 'https://d2nkw87yt5k0to.cloudfront.net/downloads/sc-' + version + '-linux.tar.gz';
					assert.equal(tunnel.url, url);
				}
			};
		})(),

		'BrowserStackTunnel': (function () {
			return {
				beforeEach: function () {
					tunnel = new BrowserStackTunnel();
				},

				'#start': function () {
					tunnelTest(this.async(), tunnel, function (error) {
						return /The tunnel reported:/.test(error.message);
					});
				},

				'#clientAuth': function () {
					tunnel.username = 'foo';
					tunnel.accessKey = 'bar';
					assert.equal(tunnel.clientAuth, 'foo:bar');
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

				'#start': function () {
					tunnelTest(this.async(), tunnel, function (error) {
						return /Could not get tunnel info/.test(error.message);
					});
				},

				'#clientAuth': function () {
					tunnel.apiKey = 'foo';
					tunnel.apiSecret = 'bar';
					assert.equal(tunnel.clientAuth, 'foo:bar');
				}
			};
		})(),

		'NullTunnel': function () {
			tunnel = new NullTunnel();
			tunnelTest(this.async(), tunnel, function (error) {
				return /Could not get tunnel info/.test(error.message);
			});
		},

		'Tunnel': (function () {
			return {
				beforeEach: function () {
					tunnel = new Tunnel({ foo: 'bar' });
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

						tunnel.isStarting = true;
						assert.throws(function () {
							tunnel.start();
						});
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
