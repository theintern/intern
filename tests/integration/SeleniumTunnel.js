define([
	'intern',
	'intern!object',
	'intern/chai!assert',
	'intern/dojo/node!dojo/request/node',
	'intern/dojo/node!../../SeleniumTunnel',
	'intern/dojo/node!fs',
	'../support/cleanup',
	'../support/tunnelTest',
	'../support/isSeleniumStarted',
	'../support/checkRemote'
], function (
	intern,
	registerSuite,
	assert,
	request,
	SeleniumTunnel,
	fs,
	cleanup,
	tunnelTest,
	isSeleniumStarted,
	checkRemote
) {
	var PORT = 4445;
	var tunnel;

	var allDriverConfigurations = [
		new SeleniumTunnel.ChromeConfig({
			_testName: 'ChromeDriver windows',
			platform: 'win32'
		}),
		new SeleniumTunnel.ChromeConfig({
			_testName: 'ChromeDriver linux 64-bit',
			platform: 'linux',
			arch: 'x64'
		}),
		new SeleniumTunnel.ChromeConfig({
			_testName: 'ChromeDriver linux 32-bit',
			platform: 'linux',
			arch: 'x86'
		}),
		new SeleniumTunnel.ChromeConfig({
			_testName: 'ChromeDriver mac',
			platform: 'darwin'
		}),
		new SeleniumTunnel.ChromeConfig({
			_testName: 'ChromeDriver windows',
			platform: 'win32'
		}),
		new SeleniumTunnel.IeConfig({
			_testName: 'IE Driver 64-bit',
			arch: 'x64'
		}),
		new SeleniumTunnel.IeConfig({
			_testName: 'IE Driver 32-bit',
			arch: 'x86'
		}),
		new SeleniumTunnel.FirefoxConfig({
			_testName: 'Firefox Driver linux',
			platform: 'linux'
		}),
		new SeleniumTunnel.FirefoxConfig({
			_testName: 'Firefox Driver mac',
			platform: 'darwin'
		}),
		new SeleniumTunnel.FirefoxConfig({
			_testName: 'Firefox Driver windows',
			platform: 'win32'
		})
	];

	function instrumentTunnel(tunnel) {
		tunnel.on('downloadprogress', function (info) {
			console.log('download progress: ', info.progress.loaded, info.progress.total);
		});
		tunnel.on('filedownloadprogress', function (info) {
			console.log(info.url, info.progress.loaded, info.progress.total);
		});
		tunnel.on('postdownload', function (url) {
			console.log('Post download', url);
		});
	}

	function assertDownload(config) {
		tunnel = new SeleniumTunnel(config || {});
		var expected = tunnel._getConfigs().map(function (config) {
			return config.executable;
		}).filter(function (executable) {
			// Remove any skipped selenium standalone
			return executable !== '..';
		});

		if (intern.args.verbose) {
			instrumentTunnel(tunnel);
		}

		return tunnel.download()
			.then(function () {
				var files = fs.readdirSync(tunnel.directory);
				assert.includeMembers(files, expected);
			});
	}

	registerSuite({
		name: 'integration/SeleniumTunnel',
		
		beforeEach: function (test) {
			test.timeout =  10 * 60 * 1000; // ten minutes

			// Ensure Selenium is not running on our test port
			return isSeleniumStarted(PORT)
				.then(function () {
					return request('http://localhost:' + PORT +
						'/selenium-server/driver/?cmd=shutDownSeleniumServer');
				}, function () {
					// We don't expect selenium to be already running
					return true;
				});
		},

		afterEach: function () {
			return cleanup(tunnel);
		},

		'remote artifact exists': (function () {
			var tests = {
				'selenium standalone': function () {
					var config = new SeleniumTunnel.SeleniumConfig();

					return checkRemote(config.url);
				}
			};

			allDriverConfigurations.forEach(function (config) {
				tests[config._testName] = function () {
					return checkRemote(config.url);
				};
			});

			return tests;
		})(),

		download: (function () {
			var tests = {
				'selenium standalone': function () {
					return assertDownload({
						seleniumDrivers: [ ]
					});
				}
			};

			allDriverConfigurations.forEach(function (config) {
				tests[config._testName] = function () {
					return assertDownload({
						// We don't want to download selenium every time so we're going to change the
						// Selenium configuration so isDownloaded() should always report true for Selenium
						seleniumVersion: new SeleniumTunnel.SeleniumConfig({
							executable: '..'
						}),
						seleniumDrivers: [ config ]
					});
				};
			});

			return tests;
		})(),

		'isDownloaded': {
			'returns false when files are missing': function () {
				if (intern.args.noClean) {
					return this.skip('Cleanup is disabled');
				}
				tunnel = new SeleniumTunnel();
				cleanup.deleteTunnelFiles(tunnel);

				assert.isFalse(tunnel.isDownloaded);
			}
		},

		'start': {
			'runs selenium-standalone': function () {
				tunnel = new SeleniumTunnel({
					port: PORT,
					seleniumDrivers: [ ]
				});

				return tunnelTest(this.async(120000), tunnel);
			}
		},

		'stop': {
			beforeEach: function () {
				tunnel = new SeleniumTunnel({
					port: PORT,
					seleniumDrivers: [ ]
				});

				return tunnel.start()
					.then(function () {
						return isSeleniumStarted(tunnel.port, tunnel.hostname);
					});
			},

			'shuts down a running selenium': function () {
				return tunnel.stop()
					.then(function () {
						return isSeleniumStarted()
							.then(function () {
								throw new Error('tunnel is still running');
							}, function () {
								return true;
							});
					});
			}
		}
	});
});
