/*jshint node:true */
/**
 * @module digdug/SauceLabsTunnel
 */
define([
	'./Tunnel',
	'dojo/request',
	'dojo/io-query',
	'dojo/node!fs',
	'dojo/node!os',
	'dojo/node!url',
	'dojo/node!path',
	'./util',
	'require'
], function (Tunnel, request, ioQuery, fs, os, urlUtil, pathUtil, util, require) {
	/**
	 * A Sauce Labs tunnel. This tunnel uses Sauce Connect 4 on platforms where it is supported, and Sauce Connect 3
	 * on all other platforms.
	 *
	 * @constructor module:digdug/SauceLabsTunnel
	 * @extends module:digdug/Tunnel
	 */
	function SauceLabsTunnel() {
		this.accessKey = process.env.SAUCE_ACCESS_KEY;
		this.directDomains = [];
		this.domainAuthentication = [];
		this.fastFailDomains = [];
		this.skipSslDomains = [];
		this.username = process.env.SAUCE_USERNAME;
		Tunnel.apply(this, arguments);
	}

	var _super = Tunnel.prototype;
	SauceLabsTunnel.prototype = util.mixin(Object.create(_super), /** @lends module:digdug/SauceLabsTunnel# */ {
		constructor: SauceLabsTunnel,

		/**
		 * The Sauce Labs access key.
		 *
		 * @type {string}
		 */
		accessKey: null,

		/**
		 * A list of domains that should not be proxied by the tunnel on the remote VM.
		 *
		 * @type {string[]}
		 */
		directDomains: null,

		directory: require.toUrl('./saucelabs/'),

		/**
		 * A list of URLs that require additional HTTP authentication. Only the hostname, port, and auth are used.
		 * This property is only supported by Sauce Connect 4 tunnels.
		 *
		 * @type {string[]}
		 */
		domainAuthentication: null,

		/**
		 * A list of regular expressions corresponding to domains whose connections should fail immediately if the VM
		 * attempts to make a connection to them.
		 *
		 * @type {string[]}
		 */
		fastFailDomains: null,

		/**
		 * Allows the tunnel to also be used by sub-accounts of the user that started the tunnel.
		 *
		 * @type {boolean}
		 */
		isSharedTunnel: false,

		/**
		 * A filename where additional logs from the tunnel should be output.
		 *
		 * @type {string}
		 */
		logFile: null,

		/**
		 * Specifies the maximum log filesize before rotation, in bytes.
		 * This property is only supported by Sauce Connect 3 tunnels.
		 *
		 * @type {number}
		 */
		logFileSize: null,

		/**
		 * Log statistics about HTTP traffic every `logTrafficStats` milliseconds.
		 * This property is only supported by Sauce Connect 4 tunnels.
		 *
		 * @type {number}
		 */
		logTrafficStats: 0,

		/**
		 * An alternative URL for the Sauce REST API.
		 * This property is only supported by Sauce Connect 3 tunnels.
		 *
		 * @type {string}
		 */
		restUrl: null,

		/**
		 * A list of domains that should not have their SSL connections re-encrypted when going through the tunnel.
		 *
		 * @type {string[]}
		 */
		skipSslDomains: null,

		/**
		 * An additional set of options to use with the Squid proxy for the remote VM.
		 * This property is only supported by Sauce Connect 3 tunnels.
		 *
		 * @type {string}
		 */
		squidOptions: null,

		/**
		 * Whether or not to use the proxy defined at {@link module:digdug/Tunnel#proxy} for the tunnel connection
		 * itself.
		 *
		 * @type {boolean}
		 */
		useProxyForTunnel: false,

		/**
		 * The Sauce Labs username.
		 *
		 * @type {string}
		 */
		username: null,

		/**
		 * Overrides the version of the VM created on Sauce Labs.
		 * This property is only supported by Sauce Connect 3 tunnels.
		 *
		 * @type {string}
		 */
		vmVersion: null,

		get clientAuth() {
			return this.username + ':' + this.accessKey;
		},

		get executable() {
			var platform = this.platform === 'darwin' ? 'osx' : this.platform;
			var architecture = this.architecture;

			if (platform === 'osx' || platform === 'win32' || (platform === 'linux' && architecture === 'x64')) {
				return './sc-4.1-' + platform + '/bin/sc' + (platform === 'win32' ? '.exe' : '');
			}
			else {
				return 'java';
			}
		},

		get extraCapabilities() {
			var capabilities = {};

			if (this.tunnelId) {
				capabilities['tunnel-identifier'] = this.tunnelId;
			}

			return capabilities;
		},

		get isDownloaded() {
			return fs.existsSync(this.executable === 'java' ?
				pathUtil.join(this.directory, 'Sauce-Connect.jar') :
				pathUtil.join(this.directory, this.executable)
			);
		},

		get url() {
			var platform = this.platform === 'darwin' ? 'osx' : this.platform;
			var architecture = this.architecture;
			var url = 'https://d2nkw87yt5k0to.cloudfront.net/downloads/sc-latest-';

			if (platform === 'osx' || platform === 'win32') {
				url += platform + '.zip';
			}
			else if (platform === 'linux' && architecture === 'x64') {
				url += platform + '.tar.gz';
			}
			else {
				url = 'https://saucelabs.com/downloads/Sauce-Connect-3.1-r32.zip';
			}

			return url;
		},

		_makeArgs: function (readyFile) {
			/*jshint maxcomplexity:11 */
			var args;
			var proxy = this.proxy ? urlUtil.parse(this.proxy) : undefined;
			if (this.executable === 'java') {
				args = [
					'-jar', 'Sauce-Connect.jar',
					this.username,
					this.accessKey
				];

				this.logFileSize && args.push('-g', this.logFileSize);
				this.squidOptions && args.push('-S', this.squidOptions);
				this.vmVersion && args.push('-V', this.vmVersion);
				this.restUrl && args.push('-x', this.restUrl);

				if (proxy) {
					proxy.hostname && args.push('-p', proxy.hostname + (proxy.port ? ':' + proxy.port : ''));

					if (proxy.auth) {
						var auth = proxy.auth.split(':');
						args.push('-u', auth[0], '-X', auth[1]);
					}
					else {
						proxy.username && args.push('-u', proxy.username);
						proxy.password && args.push('-X', proxy.password);
					}
				}
			}
			else {
				args = [
					'-u', this.username,
					'-k', this.accessKey
				];

				if (proxy) {
					if (proxy.host) {
						args.push('-p', proxy.host);
					}

					if (proxy.auth) {
						args.push('-w', proxy.auth);
					}
					else if (proxy.username) {
						args.push('-w', proxy.username + ':' + proxy.password);
					}
				}

				if (this.domainAuthentication.length) {
					this.domainAuthentication.forEach(function (domain) {
						domain = urlUtil.parse(domain);
						args.push('-a', domain.hostname + ':' + domain.port + ':' + domain.auth);
					});
				}

				this.logTrafficStats && args.push('-z', Math.floor(this.logTrafficStats / 1000));
			}

			args.push(
				'-P', this.port,
				'-f', readyFile
			);

			this.directDomains.length && args.push('-D', this.directDomains.join(','));
			this.fastFailDomains.length && args.push('-F', this.fastFailDomains.join(','));
			this.isSharedTunnel && args.push('-s');
			this.logFile && args.push('-l', this.logFile);
			this.skipSslDomains.length && args.push('-B', this.skipSslDomains.join(','));
			this.tunnelId && args.push('-i', this.tunnelId);
			this.useProxyForTunnel && args.push('-T');
			this.verbose && args.push('-d');

			return args;
		},

		sendJobState: function (jobId, data) {
			var url = urlUtil.parse(this.restUrl || 'https://saucelabs.com/rest/v1/');
			url.auth = this.username + ':' + this.accessKey;
			url.pathname += this.username + '/jobs/' + jobId;

			var payload = JSON.stringify({
				build: data.buildId,
				'custom-data': data.extra,
				name: data.name,
				passed: data.success,
				public: data.visibility,
				tags: data.tags
			});

			return request.put(url, {
				data: payload,
				handleAs: 'text',
				headers: {
					'Content-Length': Buffer.byteLength(payload, 'utf8'),
					'Content-Type': 'application/x-www-form-urlencoded'
				},
				password: this.apiSecret,
				username: this.apiKey
			}).response.then(function (response) {
				if (response.text) {
					var data = JSON.parse(response.text);

					if (data.error) {
						throw new Error(data.error);
					}
					else if (!data.success) {
						throw new Error('Job data failed to save.');
					}
				}
				else {
					throw new Error('Server reported ' + response.status + ' with no other data.');
				}
			});
		},

		_start: function () {
			var self = this;
			function readStatus(message) {
				if (
					message &&
					message.indexOf('Please wait for') === -1 &&
					message.indexOf('Sauce Connect is up') === -1 &&
					message.indexOf('Sauce Connect') !== 0 &&
					message.indexOf('Using CA certificate bundle') === -1 &&
					// Sauce Connect 3
					message.indexOf('You may start your tests') === -1
				) {
					self.emit('status', message);
				}
			}

			var readyFile = pathUtil.join(os.tmpdir(), 'saucelabs-' + Date.now());
			var child = this._makeChild(readyFile);
			var process = child.process;
			var dfd = child.deferred;

			// Polling API is used because we are only watching for one file, so efficiency is not a big deal, and the
			// `fs.watch` API has extra restrictions which are best avoided
			fs.watchFile(readyFile, { persistent: false, interval: 1007 }, function () {
				fs.unwatchFile(readyFile);

				// We have to watch for errors until the tunnel has started successfully at which point we only want to
				// watch for status messages to emit
				readMessage = readStatus;

				dfd.resolve();
			});

			var readMessage = function (message) {
				// The next chunk of data will contain a JSON object we can parse for real error data from the
				// server, so ignore the rest of this one
				if (message.indexOf('HTTP response code indicated failure.') > -1) {
					return true;
				}

				// These messages contain structured data we can try to consume
				if (message.indexOf('Error: response: ') === 0) {
					try {
						var error = /(\{[\s\S]*\})/.exec(message);
						if (error) {
							error = JSON.parse(error[1]);
							dfd.reject(new Error(error.error));
						}
					}
					catch (error) {
						// It seems parsing did not work so well; fall through to the normal error handler
					}
				}

				if (message.indexOf('Error: ') === 0) {
					dfd.reject(new Error(message.slice('Error: '.length)));
					return true;
				}

				// Sauce Connect 3
				if (message.indexOf('Problem connecting to Sauce Labs REST API') > -1) {
					// It will just keep trying and trying and trying for a while, but it is a failure, so force it
					// to stop
					process.kill('SIGTERM');
					dfd.reject(message);
					return true;
				}

				return readStatus(message);
			};

			// Sauce Connect exits with a zero status code when there is a failure, and outputs error messages to
			// stdout, like a boss
			this._handles.push(util.on(process.stdout, 'data', function (data) {
				data.split('\n').some(function (message) {
					// Get rid of the date/time prefix on each message
					var delimiter = message.indexOf(' - ');
					if (delimiter > -1) {
						message = message.slice(delimiter + 3);
					}

					message = message.trim();

					readMessage(message);
				});
			}));

			return child;
		}
	});

	return SauceLabsTunnel;
});
