import intern = require('intern');
import assert = require('intern/chai!assert');
import registerSuite = require('intern!object');
import { readdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import SeleniumTunnel, { DriverFile } from 'src/SeleniumTunnel';
import { addStartStopTest } from '../support/integration';
import { cleanup, deleteTunnelFiles } from '../support/util';
import { mkdirSync } from 'fs';
import Test = require('intern/lib/Test');

function createDownloadTest(config: any) {
	return function() {
		tunnel = new SeleniumTunnel();
		Object.keys(config).forEach(key => {
			Object.defineProperty(tunnel, key, { value: config[key] });
		});

		mkdirSync(tunnel.directory);

		const expected = tunnel['_getDriverConfigs']()
			.map((config: DriverFile) => {
				return config.executable;
			})
			.concat(tunnel.artifact)
			.filter((executable: string) => {
				// Remove any skipped artifacts
				return executable !== '.';
			});

		// Check that the progress callback is called
		let progressed = false;

		tunnel.on('downloadprogress', () => {
			progressed = true;
		});

		return tunnel.download().then(function() {
			const files = readdirSync(tunnel.directory);
			assert.includeMembers(files, expected);
			assert.isTrue(progressed, 'expected to have seen progress');
		});
	};
}

let tunnel: SeleniumTunnel;

const suite = {
	name: 'integration/SeleniumTunnel',

	beforeEach: function(test: Test) {
		test.timeout = 10 * 60 * 1000; // ten minutes
	},

	afterEach: function() {
		return cleanup(tunnel);
	},

	download: (function() {
		const tests: any = {
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
			{ name: 'edge' },
			{ name: 'firefox', platform: 'linux' },
			{ name: 'firefox', platform: 'darwin' },
			{ name: 'firefox', platform: 'win32' }
		].forEach(function(config: any) {
			let testName = config.name;
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
				// We don't want to download selenium every time so we're going
				// to change the Selenium configuration so isDownloaded() should
				// always report true for Selenium
				artifact: '.',
				drivers: [config]
			});
		});

		return tests;
	})(),

	isDownloaded: function(this: Test) {
		if (intern.args.noClean) {
			return this.skip('Cleanup is disabled');
		}
		tunnel = new SeleniumTunnel();
		deleteTunnelFiles(tunnel);

		assert.isFalse(tunnel.isDownloaded);
	},

	'version check': function() {
		const version = '2.25';
		tunnel = new SeleniumTunnel({
			drivers: [{ name: 'chrome', version }]
		});
		return tunnel.download().then(() => {
			const driver = join(tunnel.directory, 'chromedriver');
			const result = execSync(`"${driver}" --version`).toString('utf-8');
			assert.match(
				result,
				new RegExp(`ChromeDriver ${version}\.`),
				'unexpected driver version'
			);
		});
	}
};

addStartStopTest(suite, SeleniumTunnel, {
	needsAuthData: false
});

registerSuite(suite);
