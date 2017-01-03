/**
 * @module digdug/CrossBrowserTestingTunnel
 */

var fs = require('fs');
var os = require('os');
var pathUtil = require('path');
var request = require('dojo/request');
var Tunnel = require('./Tunnel');
var util = require('./util');
var Promise = require('dojo/Promise');

var CBT_VERSION = '0.0.34';

/**
 * A CrossBrowserTesting tunnel.
 *
 * This tunnel requires some non-standard configuration options (vs the other tunnels):
 *
 *   1. The capabilities must include the username, API key, browser_api_name, and os_api_name properties
 *   2. The Intern proxyUrl must use 'local' instead of 'localhost'
 *
 * An Intern config using this tunnel might be look like:
 *
 * ```js
 * define({
 * 	proxyUrl: 'http://local:9000',
 * 
 * 	tunnel: 'CrossBrowserTesting',
 * 
 * 	environments: [
 * 		{
 * 			browserName: 'chrome',
 * 			os_api_name: 'Win10',
 * 			browser_api_name: 'Chrome52'
 * 		}
 * 	]
 * 
 * 	// Other Intern config options...
 * });
 * ```
 *
 * @constructor module:digdug/CrossBrowserTestingTunnel
 * @extends module:digdug/Tunnel
 */
function CrossBrowserTestingTunnel() {
	this.apiKey = process.env.CBT_APIKEY;
	this.username = process.env.CBT_USERNAME;
	this.cbtVersion = CBT_VERSION;
	Tunnel.apply(this, arguments);
}

var _super = Tunnel.prototype;

CrossBrowserTestingTunnel.prototype = util.mixin(Object.create(_super), /** @lends module:digdug/CrossBrowserTestingTunnel# */ {
	constructor: CrossBrowserTestingTunnel,

	/**
	 * The CrossBrowserTesting API key. This will be initialized with the value of the `CBT_APIKEY` environment
	 * variable.
	 *
	 * @type {string}
	 * @default the value of the CBT_APIKEY environment variable
	 */
	apiKey: null,

	/**
	 * The CrossBrowserTesting username. This will be initialized with the value of the `CBT_USERNAME` environment
	 * variable.
	 *
	 * @type {string}
	 * @default the value of the CBT_USERNAME environment variable
	 */
	username: null,

	/**
	 * The URL of a service that provides a list of environments supported by CrossBrowserTesting.
	 */
	environmentUrl: 'https://crossbrowsertesting.com/api/v3/selenium/browsers?format=json',

	executable: 'node',

	hostname: 'hub.crossbrowsertesting.com',

	port: 80,

	get auth() {
		return (this.username || '') + ':' + (this.apiKey || '');
	},

	get extraCapabilities() {
		return {
			username: this.username,
			password: this.apiKey
		};
	},

	get isDownloaded() {
		try {
			require('cbt_tunnels');
			return true;
		}
		catch (error) {
			return false;
		}
	},

	download: function (forceDownload) {
		if (!forceDownload && this.isDownloaded) {
			return Promise.resolve();
		}
		var cbtVersion = this.cbtVersion;
		return new Promise(function (resolve, reject) {
			var child_process = require('child_process');
			child_process.exec('npm install cbt_tunnels@' + cbtVersion, function (error, stdout, stderr) {
				if (error) {
					console.error(stderr);
					reject(error);
				}
				resolve();
			});
		});
	},

	_makeArgs: function (readyFile) {
		return [
			'node_modules/.bin/cbt_tunnels',
			'--authkey', this.apiKey,
			'--username', this.username,
			'--ready', readyFile
		];
	},

	sendJobState: function (jobId, data) {
		var payload = JSON.stringify({
			action: 'set_score',
			score: (data.status || data.success) ? 'pass' : 'fail'
		});

		return request.put('https://crossbrowsertesting.com/api/v3/selenium/' + jobId, {
			data: payload,
			handleAs: 'text',
			headers: {
				'Content-Length': Buffer.byteLength(payload, 'utf8'),
				'Content-Type': 'application/json'
			},
			user: this.username,
			password: this.apiKey,
			proxy: this.proxy
		}).then(function (response) {
			if (response.data) {
				var data = JSON.parse(response.data);

				if (data.status) {
					throw new Error('Could not save test status (' + data.message + ')');
				}

				if (response.statusCode !== 200) {
					throw new Error('Server reported ' + response.statusCode + ' with: ' + response.data);
				}
			}
			else {
				throw new Error('Server reported ' + response.statusCode + ' with no other data.');
			}
		});
	},

	_start: function () {
		var readyFile = pathUtil.join(os.tmpdir(), 'CrossBrowserTesting-' + Date.now());
		var child = this._makeChild(readyFile);
		var childProcess = child.process;
		var dfd = child.deferred;
		var stdout = [];

		// Polling API is used because we are only watching for one file, so efficiency is not a big deal, and the
		// `fs.watch` API has extra restrictions which are best avoided
		fs.watchFile(readyFile, { persistent: false, interval: 1007 }, function (current, previous) {
			if (Number(current.mtime) === Number(previous.mtime)) {
				// readyFile hasn't been modified, so ignore the event
				return;
			}

			fs.unwatchFile(readyFile);
			readHandle.remove();
			exitHandle.remove();
			stdout = null;
			dfd.resolve();
		});

		// The cbt tunnel outputs its startup error messages on stdout. Capture any data on stdout and display it if the
		// process exits early.
		var readHandle = util.on(childProcess.stdout, 'data', function (data) {
			stdout.push(data);
		});
		var exitHandle = util.on(childProcess, 'exit', function () {
			process.stderr.write(stdout.join(''));
		});

		this._handles.push(readHandle);
		this._handles.push(exitHandle);

		return child;
	},

	/**
	 * Attempt to normalize a TestingBot described environment with the standard Selenium capabilities
	 *
	 * TestingBot returns a list of environments that looks like:
	 *
	 * {
	 *     "selenium_name": "Chrome36",
	 *     "name": "googlechrome",
	 *     "platform": "CAPITAN",
	 *     "version":"36"
	 * }
	 *
	 * @param {Object} environment a TestingBot environment descriptor
	 * @returns a normalized descriptor
	 * @private
	 */
	_normalizeEnvironment: function (environment) {
		var platform = environment.api_name;

		return environment.browsers.map(function (browser) {
			var browserName = browser.type.toLowerCase();

			return {
				platform: platform,
				browserName: browserName,
				version: browser.version,

				descriptor: environment,

				intern: {
					browserName: browserName,
					version: browser.version,
					browser_api_name: browser.api_name,
					os_api_name: platform
				}
			};
		});
	}
});

module.exports = CrossBrowserTestingTunnel;
