/* jshint dojo:true */
define([
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

		'Sauce Labs': (function () {
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
				},

				'#extraCapabilities': function () {
					assert.deepEqual(tunnel.extraCapabilities, {});
					tunnel.tunnelId = 'foo';
					assert.deepEqual(tunnel.extraCapabilities, { 'tunnel-identifier': 'foo' });
				},

				'#url': function () {
					tunnel.platform = 'foo';
					tunnel.architecture = 'bar';
					assert.equal(tunnel.url, 'https://saucelabs.com/downloads/Sauce-Connect-3.1-r32.zip');

					tunnel.platform = 'osx';
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

		'BrowserStack': function () {
			tunnel = new BrowserStackTunnel();
			tunnelTest(this.async(), tunnel, function (error) {
				return /The tunnel reported:/.test(error.message);
			});
		},

		'TestingBot': function () {
			tunnel = new TestingBotTunnel();
			tunnelTest(this.async(), tunnel, function (error) {
				return /Could not get tunnel info/.test(error.message);
			});
		},

		'Null': function () {
			tunnel = new NullTunnel();
			tunnelTest(this.async(), tunnel, function (error) {
				return /Could not get tunnel info/.test(error.message);
			});
		}
	});
});
