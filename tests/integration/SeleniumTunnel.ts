define([
	'intern',
	'intern!object',
	'intern/chai!assert',
	'intern/dojo/node!dojo/request/node',
	'intern/dojo/node!../../SeleniumTunnel',
	'intern/dojo/node!fs',
	'intern/dojo/node!https',
	'intern/dojo/node!url',
	'intern/dojo/Promise',
	'../support/integration',
	'../support/util'
], function (
	intern,
	registerSuite,
	assert,
	request,
	SeleniumTunnel,
	fs,
	https,
	urlUtil,
	Promise,
	support,
	util
) {
	function createDownloadTest(config) {
		return function () {
			tunnel = new SeleniumTunnel(config || {});

			var expected = tunnel._getDriverConfigs().map(function (config) {
				return config.executable;
			}).concat(tunnel.artifact).filter(function (executable) {
				// Remove any skipped artifacts
				return executable !== '.';
			});

			if (intern.args.verbose) {
				tunnel.on('downloadprogress', function (info) {
					process.stdout.write('.');
					if (info.loaded >= info.total) {
						process.stdout.write('\n');
					}
				});
			}

			// Check that the progress callback is called
			var progressed = false;

			return tunnel.download()
				.then(
					function () {
						var files = fs.readdirSync(tunnel.directory);
						assert.includeMembers(files, expected);
						assert.isTrue(progressed, 'expected to have seen progress');
					},
					null,
					function () {
						progressed = true;
					}
				);
		};
	}

	var tunnel;

	var suite = {
		name: 'integration/SeleniumTunnel',
		
		beforeEach: function (test) {
			test.timeout =  10 * 60 * 1000; // ten minutes
		},

		afterEach: function () {
			return util.cleanup(tunnel);
		},

		download: (function () {
			var tests = {
				'selenium standalone': createDownloadTest({ drivers: [] })
			};

			[
				{ name: 'chrome', platform: 'win32' },
				{ name: 'chrome', platform: 'linux', arch: 'x64' },
				{ name: 'chrome', platform: 'linux', arch: 'x86' },
				{ name: 'chrome', platform: 'darwin', version: '2.22' },
				{ name: 'chrome', platform: 'darwin', version: '2.23' },
				{ name: 'ie', arch: 'x64' },
				{ name: 'ie', arch: 'x86' },
				{ name: 'firefox', platform: 'linux' },
				{ name: 'firefox', platform: 'darwin' },
				{ name: 'firefox', platform: 'win32' },
			].forEach(function (config) {
				var testName = config.name;
				if (config.platform) {
					testName += '-' + config.platform;
				}
				if (config.arch) {
					testName += '-' + config.arch;
				}
				if (config.version) {
					testName += '-' + config.version;
				}
				tests[testName] = createDownloadTest({
					// We don't want to download selenium every time so we're going to change the Selenium configuration
					// so isDownloaded() should always report true for Selenium
					artifact: '.',
					drivers: [ config ]
				});
			});

			return tests;
		})(),

		isDownloaded: function () {
			if (intern.args.noClean) {
				return this.skip('Cleanup is disabled');
			}
			tunnel = new SeleniumTunnel();
			util.deleteTunnelFiles(tunnel);

			assert.isFalse(tunnel.isDownloaded);
		}
	};

	support.addStartStopTest(suite, SeleniumTunnel, {
		needsAuthData: false
	});

	registerSuite(suite);
});
