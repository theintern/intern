/**
 * @module digdug/SeleniumTunnel
 */

var format = require('util').format;
var fs = require('fs');
var mkdirp = require('mkdirp');
var pathUtil = require('path');
var Promise = require('dojo/Promise');
var request = require('dojo/request');
var Tunnel = require('./Tunnel');
var util = require('./util');

/**
 * Artifact configuration information for the Selenium standalone jar
 * @param config {String|Object} a selenium version number or mixin properties
 * @constructor
 */
function SeleniumConfig(config) {
	if (typeof config === 'string') {
		this.version = config;
	}
	else {
		util.mixin(this, config);
	}
}

SeleniumConfig.prototype = {
	constructor: SeleniumConfig,
	version: '2.53.0',
	baseUrl: 'https://selenium-release.storage.googleapis.com',
	dontExtract: true,
	get artifact() {
		return 'selenium-server-standalone-' + this.version + '.jar';
	},
	get url() {
		var majorMinorVersion = this.version.slice(0, this.version.lastIndexOf('.'));

		return format(
			'%s/%s/%s',
			this.baseUrl,
			majorMinorVersion,
			this.artifact
		);
	},
	get executable() {
		return 'selenium-server-' + this.version + '-server.jar';
	}
};

/**
 * Artifact configuration information for the Chrome driver
 * @param config {Object} mixin properties
 * @constructor
 */
function ChromeConfig(config) {
	util.mixin(this, config);
}

ChromeConfig.prototype = {
	constructor: ChromeConfig,
	version: '2.22',
	baseUrl: 'https://chromedriver.storage.googleapis.com',
	platform: process.platform,
	arch: process.arch,
	get artifact() {
		var platform = 'win32';

		if (this.platform === 'linux') {
			platform = 'linux' + (this.arch === 'x64' ? '64' : '32');
		}
		else if (this.platform === 'darwin') {
			platform = 'mac32';
		}

		return 'chromedriver_' + platform + '.zip';
	},
	get url() {
		return format(
			'%s/%s/%s',
			this.baseUrl,
			this.version,
			this.artifact
		);
	},
	get executable() {
		return this.platform === 'win32' ? 'chromedriver.exe' : 'chromedriver';
	},
	get seleniumProperty() {
		return 'webdriver.chrome.driver';
	}
};

/**
 * Artifact configuration information for Internet Explorer driver
 * @param config {Object} mixin properties
 * @constructor
 */
function IeConfig(config) {
	util.mixin(this, config);
}

IeConfig.prototype = {
	constructor: IeConfig,
	version: '2.53.0',
	baseUrl: 'https://selenium-release.storage.googleapis.com',
	arch: process.arch,
	get artifact() {
		var architecture = this.arch === 'x64' ? 'x64' : 'Win32';

		return format(
			'IEDriverServer_%s_%s.zip',
			architecture,
			this.version
		);
	},
	get url() {
		var majorMinorVersion = this.version.slice(0, this.version.lastIndexOf('.'));

		return format(
			'%s/%s/%s',
			this.baseUrl,
			majorMinorVersion,
			this.artifact
		);
	},
	get executable() {
		return 'IEDriverServer.exe';
	},
	get seleniumProperty() {
		return 'webdriver.ie.driver';
	}
};

/**
 * Artifact configuration information for the Firefox driver
 * @param config {Object} mixin properties
 * @constructor
 */
function FirefoxConfig(config) {
	util.mixin(this, config);
}

FirefoxConfig.prototype = {
	constructor: FirefoxConfig,
	version: '0.9.0',
	baseUrl: 'https://github.com/mozilla/geckodriver/releases/download',
	platform: process.platform,
	get artifact() {
		var platform = (this.platform === 'linux' ? 'linux64'
			: this.platform === 'darwin' ? 'mac' : 'win64');
		var type = (this.platform === 'win32' ? '.zip' : '.tar.gz');

		return format(
			'geckodriver-v%s-%s%s',
			this.version,
			platform,
			type
		);
	},
	get url() {
		return format(
			'%s/v%s/%s',
			this.baseUrl,
			this.version,
			this.artifact
		);
	},
	get executable() {
		return this.platform === 'win32' ? 'geckodriver.exe' : 'geckodriver';
	},
	get seleniumProperty() {
		return 'webdriver.gecko.driver';
	}
};

var driverNameMap = {
	chrome: ChromeConfig,
	ie: IeConfig,
	firefox: FirefoxConfig
};

/**
 * The Selenium Tunnel responsible for downloading, starting and stopping Selenium standalone
 * @constructor
 */
function SeleniumTunnel() {
	Tunnel.apply(this, arguments);
	
	if (this.seleniumDrivers === null) {
		this.seleniumDrivers = [ 'chrome' ];
	}
}

var _super = Tunnel.prototype;
SeleniumTunnel.prototype = util.mixin(Object.create(_super), /** @lends module:digdug/SauceLabsTunnel# */ {
	constructor: SeleniumTunnel,

	/**
	 * Additional arguments to send to Selenium standalone on start
	 *
	 * @type {Array}
	 */
	seleniumArgs: null,

	/**
	 * The desired selenium drivers to install. This is a list of driver definitions that may either be a basic string
	 * or an object.
	 *
	 * example:
	 * 	[
	 * 		'chrome',
	 * 		{
	 * 			name: 'firefox',
	 * 			version: '0.8.0',
	 * 			baseUrl: 'https://github.com/mozilla/geckodriver/releases/download'
	 * 		}
	 * 	]
	 *
	 * @type {Array}
	 * @default [ 'chrome' ]
	 */
	seleniumDrivers: null,

	/**
	 * The desired version of selenium to install. This can be defined using a version number or an object containing a
	 * version number and baseUrl.
	 *
	 * example:
	 * 	{
	 * 		version: '2.53.0',
	 * 		baseUrl: 'https://selenium-release.storage.googleapis.com'
	 * 	}
	 *
	 * @type {string|object}
	 * @default
	 */
	seleniumVersion: SeleniumConfig.prototype.version,

	/**
	 * Timeout for communicating with Selenium Services
	 */
	serviceTimeout: 5000,

	get directory() {
		return pathUtil.join(__dirname, 'selenium-standalone');
	},

	get executable() {
		return 'java';
	},

	get isDownloaded() {
		var directory = this.directory;
		return this._getConfigs().every(function (config) {
			return fs.existsSync(pathUtil.join(directory, config.executable));
		});
	},

	_getDriverConfigs: function () {
		return this.seleniumDrivers.map(function (data) {
			var Constructor;
			if (typeof data === 'string') {
				Constructor = driverNameMap[data];
				return new Constructor();
			}
			if (typeof data === 'object' && data.name) {
				Constructor = driverNameMap[data];
				return new Constructor(data);
			}
			return data;
		});
	},

	_getConfigs: function () {
		var configs = this._getDriverConfigs();
		configs.push(new SeleniumConfig(this.seleniumVersion));
		return configs;
	},

	download: function (forceDownload) {
		if (!forceDownload && this.isDownloaded) {
			return Promise.resolve();
		}

		var self = this;
		var tasks = this._getConfigs().map(function (config) {
			var executable = config.executable;
			var path = pathUtil.join(self.directory, executable);

			if (fs.existsSync(path)) {
				return Promise.resolve();
			}

			var options = util.mixin({}, SeleniumTunnel.prototype, self, {
				url: config.url,
				executable: executable,
				dontExtract: !!config.dontExtract
			});
			
			return self._downloadFile(options);
		});
		
		return Promise.all(tasks);
	},

	_postDownload: function (response, options) {
		this.emit('postdownload', options.url);
		if (options.dontExtract) {
			return this._writeFile(response.data, options);
		}
		else {
			return this._decompressData(response.data, options);
		}
	},
	
	_writeFile: function (data, options) {
		return new Promise(function (resolve, reject) {
			var target = pathUtil.join(options.directory, options.executable);

			mkdirp(options.directory, function (error) {
				if (error) {
					reject(error);
					return;
				}

				fs.writeFile(target, data, function (error) {
					if (error) {
						reject(error);
						return;
					}
					
					resolve();
				});
			});
		});
	},
	
	_makeArgs: function () {
		var directory = this.directory;
		var seleniumConfig = new SeleniumConfig(this.seleniumVersion);
		var driverConfigs = this._getDriverConfigs();
		var args = [
			'-jar',
			pathUtil.join(this.directory, seleniumConfig.executable),
			'-port',
			this.port
		];
		
		driverConfigs.reduce(function (args, config) {
			var file = pathUtil.join(directory, config.executable);
			args.push('-D' + config.seleniumProperty + '=' + file);
			return args;
		}, args);

		if (this.seleniumArgs) {
			args = args.concat(this.seleniumArgs);
		}

		if (this.verbose) {
			args.push('-debug');
			console.log('starting with arguments: ', args.join(' '));
		}
		
		return args;
	},

	_start: function () {
		var self = this;
		var childHandle = this._makeChild();
		var child = childHandle.process;
		var dfd = childHandle.deferred;
		var handle = util.on(child.stderr, 'data', function (data) {
			// Selenium recommends that we poll the hub looking for a status response
			// https://github.com/seleniumhq/selenium-google-code-issue-archive/issues/7957
			// We're going against the recommendation here for a few reasons
			// 1. There's no default pid or log to look for errors to provide a specific failure
			// 2. Polling on a failed server start could leave us with an unpleasant wait
			// 3. Just polling a selenium server doesn't guarantee it's the server we started
			// 4. This works pretty well
			if (data.indexOf('Selenium Server is up and running') > -1) {
				dfd.resolve();
			}
			if (self.verbose) {
				console.log(data);
			}
		});
		var removeHandle = handle.remove.bind(handle);

		dfd.promise.then(removeHandle, removeHandle);

		return childHandle;
	},

	_stop: function () {
		var self = this;

		return request('http://' + this.hostname + ':' + this.port +
			'/selenium-server/driver/?cmd=shutDownSeleniumServer', {
			timeout: this.serviceTimeout,
			handleAs: 'text'
		}).then(function (response) {
			var text = response.data.toString();
			if (text !== 'OKOK') {
				throw new Error('Tunnel not shut down');
			}
			return _super._stop.apply(self);
		});
	},
	
	sendJobState: function () {
		// This is a noop for Selenium
		return Promise.resolve();
	}
});

SeleniumTunnel.SeleniumConfig = SeleniumConfig;
SeleniumTunnel.ChromeConfig = ChromeConfig;
SeleniumTunnel.FirefoxConfig = FirefoxConfig;
SeleniumTunnel.IeConfig = IeConfig;
module.exports = SeleniumTunnel;
