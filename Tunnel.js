/*jshint node:true */
/**
 * @module digdug/Tunnel
 */
define([
	'./util',
	'dojo/Deferred',
	'dojo/Evented',
	'dojo/node!child_process',
	'dojo/node!fs',
	'dojo/node!path',
	'dojo/node!url',
	'dojo/node!http',
	'dojo/node!https',
	'dojo/node!decompress'
], function (util, Deferred, Evented, spawnUtil, fs, pathUtil, urlUtil, http, https, decompress) {
	// TODO: Spawned processes are not getting cleaned up if there is a crash

	/**
	 * Clears an array of remover handles.
	 *
	 * @param {Handle[]} handles
	 */
	function clearHandles(handles) {
		var handle;
		while ((handle = handles.pop())) {
			handle.remove();
		}
	}

	/**
	 * Performs a GET request to a remote server.
	 *
	 * @param {string} url The target URL.
	 * @returns {Promise.<module:http.IncomingMessage>} A promise that resolves to the response object for the request.
	 */
	function get(url) {
		url = urlUtil.parse(url);
		url.method = 'GET';

		var dfd = new Deferred(function () {
			request && request.abort();
			request = null;
		});

		// TODO: This is not a great way of capturing async stack traces, but this pattern is used in several areas;
		// can we do it better?
		var capture = {};
		Error.captureStackTrace(capture);

		var request = (url.protocol === 'https:' ? https : http).request(url);
		request.once('response', dfd.resolve.bind(dfd));
		request.once('error', function (error) {
			error.stack = error.stack + capture.stack.replace(/^[^\n]+/, '');
			dfd.reject(error);
		});
		request.end();

		return dfd.promise;
	}

	/**
	 * Creates a new function that emits an event of type `type` on `target` every time the returned function is called.
	 *
	 * @param {module:dojo/Evented} target A target event emitter.
	 * @param {string} type The type of event to emit.
	 * @returns {Function} The function to call to trigger an event.
	 */
	function proxyEvent(target, type) {
		return function (data) {
			target.emit(type, data);
		};
	}

	/**
	 * A Tunnel is a mechanism for connecting to a WebDriver service provider that securely exposes local services for
	 * testing within the service provider’s network.
	 *
	 * @constructor module:digdug/Tunnel
	 * @param {Object} kwArgs
	 */
	function Tunnel(kwArgs) {
		Evented.apply(this, arguments);
		for (var key in kwArgs) {
			Object.defineProperty(this, key, Object.getOwnPropertyDescriptor(kwArgs, key));
		}
	}

	var _super = Evented.prototype;
	Tunnel.prototype = util.mixin(Object.create(_super), /** @lends module:digdug/Tunnel# */ {
		/**
		 * Part of the tunnel has been downloaded from the server.
		 *
		 * @event module:digdug/Tunnel#downloadprogress
		 * @type {Object}
		 * @property {number} received The number of bytes received so far.
		 * @property {number} total The total number of bytes to download.
		 */

		/**
		 * A chunk of raw string data output by the tunnel software to stdout.
		 *
		 * @event module:digdug/Tunnel#stdout
		 * @type {string}
		 */

		/**
		 * A chunk of raw string data output by the tunnel software to stderr.
		 *
		 * @event module:digdug/Tunnel#stderr
		 * @type {string}
		 */

		/**
		 * Information about the status of the tunnel setup process that is suitable for presentation to end-users.
		 *
		 * @event module:digdug/Tunnel#status
		 * @type {string}
		 */

		constructor: Tunnel,

		/**
		 * The architecture the tunnel will run against. This information is automatically retrieved for the current
		 * system at runtime.
		 *
		 * @type {string}
		 */
		architecture: process.arch,

		/**
		 * An HTTP authorization string to use when initiating connections to this tunnel.
		 *
		 * @type {string}
		 */
		clientAuth: null,

		/**
		 * The directory where the tunnel software will be extracted. If the directory does not exist, it will be
		 * created.
		 *
		 * @type {string}
		 */
		directory: null,

		/**
		 * The executable to spawn in order to create a tunnel.
		 *
		 * @type {string}
		 */
		executable: null,

		/**
		 * Whether or not the tunnel is currently running.
		 *
		 * @type {boolean}
		 * @readonly
		 */
		isRunning: false,

		/**
		 * Whether or not the tunnel is currently starting up.
		 *
		 * @type {boolean}
		 * @readonly
		 */
		isStarting: false,

		/**
		 * Whether or not the tunnel is currently stopping.
		 *
		 * @type {boolean}
		 * @readonly
		 */
		isStopping: false,

		/**
		 * The operating system the tunnel will run on. This information is automatically retrieved for the current
		 * system at runtime.
		 *
		 * @type {string}
		 */
		platform: process.platform,

		/**
		 * The local port where the WebDriver server should be exposed by the tunnel.
		 *
		 * @type {number}
		 */
		port: 4444,

		/**
		 * The URL of a proxy server for the tunnel to go through. Only the hostname, port, and auth are used.
		 *
		 * @type {string}
		 */
		proxy: null,

		/**
		 * A unique identifier for the newly created tunnel.
		 *
		 * @type {string=}
		 */
		tunnelId: null,

		/**
		 * The URL where the tunnel software can be downloaded.
		 *
		 * @type {string}
		 */
		url: null,

		/**
		 * Whether or not to tell the tunnel to provide verbose logging output.
		 *
		 * @type {boolean}
		 */
		verbose: false,

		_handles: null,
		_process: null,

		/**
		 * A map of additional capabilities that need to be sent to the provider when a new session is being created.
		 *
		 * @member {string} extraCapabilities
		 * @memberOf module:digdug/Tunnel#
		 * @type {Object}
		 * @readonly
		 */
		get extraCapabilities() {
			return {};
		},

		/**
		 * Whether or not the tunnel software has already been downloaded.
		 *
		 * @member {string} isDownloaded
		 * @memberOf module:digdug/Tunnel#
		 * @type {boolean}
		 * @readonly
		 */
		get isDownloaded() {
			return fs.existsSync(pathUtil.join(this.directory, this.executable));
		},

		/**
		 * Downloads and extracts the tunnel software if it is not already downloaded.
		 *
		 * This method can be extended by implementations to perform any necessary post-processing, such as setting
		 * appropriate file permissions on the downloaded executable.
		 *
		 * @param {boolean} forceDownload Force downloading the software even if it already has been downloaded.
		 * @returns {Promise.<void>} A promise that resolves once the download and extraction process has completed.
		 */
		download: function (forceDownload) {
			var dfd = new Deferred(function (reason) {
				request && request.cancel(reason);
				request = null;
			});

			if (!forceDownload && this.isDownloaded) {
				dfd.resolve();
				return dfd.promise;
			}

			var target = this.directory;
			var request;
			function download(url) {
				request = get(url);
				request.then(function (response) {
					if (response.statusCode === 200) {
						var receivedLength = 0;
						var totalLength = +response.headers['content-length'] || Infinity;
						var decompressor = decompress({ ext: url, path: target });

						response.pipe(decompressor);

						response.on('data', function (data) {
							receivedLength += data.length;
							dfd.progress({ received: receivedLength, total: totalLength });
						});

						decompressor.on('close', function () {
							dfd.resolve();
						});
					}
					else if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
						download(response.headers.location);
					}
					else {
						var responseData = '';
						response.on('data', function (data) {
							responseData += data.toString('utf8');
						});

						response.on('end', function () {
							var error = new Error('Server error: ' + (responseData || 'status ' + response.statusCode));
							dfd.reject(error);
						});
					}
				}).otherwise(function (error) {
					dfd.reject(error);
				});
			}

			download(this.url);

			return dfd.promise;
		},

		/**
		 * Creates the list of command-line arguments to be passed to the spawned tunnel. Implementations should
		 * override this method to provide the appropriate command-line arguments.
		 *
		 * Arguments passed to {@link module:digdug/Tunnel#_makeChild} will be passed as-is to this method.
		 *
		 * @protected
		 * @returns {string[]} A list of command-line arguments.
		 */
		_makeArgs: function () {
			return [];
		},

		/**
		 * Creates a newly spawned child process for the tunnel software. Implementations should call this method to
		 * create the tunnel process.
		 *
		 * Arguments passed to this method will be passed as-is to {@link module:digdug/Tunnel#_makeArgs} and
		 * {@link module:digdug/Tunnel#_makeOptions}.
		 *
		 * @protected
		 * @returns {{ process: module:ChildProcess, deferred: module:dojo/Deferred }}
		 * An object containing a newly spawned Process and a Deferred that will be resolved once the tunnel has started
		 * successfully.
		 */
		_makeChild: function () {
			var command = this.executable;
			var args = this._makeArgs.apply(this, arguments);
			var options = this._makeOptions.apply(this, arguments);

			var dfd = new Deferred();
			var process = spawnUtil.spawn(command, args, options);

			process.stdout.setEncoding('utf8');
			process.stderr.setEncoding('utf8');

			// Detect and reject on common errors, but only until the promise is fulfilled, at which point we should
			// no longer be managing any events since it means the process has started successfully and is underway
			var errorMessage = '';
			var errorCode = 0;
			var handles = [
				util.on(process, 'error', dfd.reject.bind(dfd)),
				util.on(process.stderr, 'data', function (data) {
					errorMessage += data;
				}),
				util.on(process, 'exit', function (code) {
					errorCode = code;
				}),
				// stderr might still have data in buffer at the time the exit event is sent, so we have to store data
				// from stderr and the exit code and reject only once stderr closes
				util.on(process.stderr, 'close', function () {
					if (errorCode > 0) {
						dfd.reject(new Error(errorMessage || 'Unknown error: Exit code ' + errorCode));
					}
				})
			];

			dfd.promise.always(function () {
				clearHandles(handles);
			});

			return {
				process: process,
				deferred: dfd
			};
		},

		/**
		 * Creates the set of options to use when spawning the tunnel process. Implementations should override this
		 * method to provide the appropriate options for the tunnel software.
		 *
		 * Arguments passed to {@link module:digdug/Tunnel#_makeChild} will be passed as-is to this method.
		 *
		 * @protected
		 * @returns {Object} A set of options matching those provided to Node.js {@link module:child_process.spawn}.
		 */
		_makeOptions: function () {
			return {
				cwd: this.directory,
				env: process.env
			};
		},

		/**
		 * Sends information about a job to the tunnel provider.
		 *
		 * @param {string} jobId The job to send data about. This is usually a session ID.
		 * @param {JobState} data Data to send to the tunnel provider about the job.
		 */
		sendJobState: function () {
			var dfd = new Deferred();
			dfd.reject(new Error('Job state is not supported by this tunnel.'));
			return dfd.promise;
		},

		/**
		 * Starts the tunnel, automatically downloading dependencies if necessary.
		 *
		 * @returns {Promise.<void>} A promise that resolves once the tunnel has been established.
		 */
		start: function () {
			if (this.isRunning) {
				throw new Error('Tunnel is already running');
			}
			else if (this.isStopping) {
				throw new Error('Previous tunnel is still terminating');
			}
			else if (this.isStarting) {
				throw new Error('Tunnel is already launching');
			}

			this.isStarting = true;

			var self = this;
			return this
				.download()
				.then(null, null, function (progress) {
					self.emit('downloadprogress', progress);
				})
				.then(function () {
					self._handles = [];
					return self._start();
				})
				.then(function (child) {
					var process = child.process;
					self._process = process;
					self._handles.push(
						util.on(process.stdout, 'data', proxyEvent(self, 'stdout')),
						util.on(process.stderr, 'data', proxyEvent(self, 'stderr'))
					);
					return child.deferred.promise;
				})
				.then(function (returnValue) {
					self.emit('status', 'Ready');
					self.isStarting = false;
					self.isRunning = true;
					return returnValue;
				}, function (error) {
					self.emit('status', String(error));
					self.isStarting = false;
					throw error;
				});
		},

		/**
		 * This method provides the implementation that actually starts the tunnel and any other logic for emitting
		 * events on the Tunnel based on data passed by the tunnel software.
		 *
		 * The default implementation that assumes the tunnel is ready for use once the child process has written to
		 * `stdout` or `stderr`. This method should be reimplemented by other tunnel launchers to implement correct
		 * launch detection logic.
		 *
		 * @protected
		 * @returns {{ process: module:ChildProcess, deferred: module:dojo/Deferred }}
		 * An object containing a reference to the child process, and a Deferred that is resolved once the tunnel is
		 * ready for use. Normally this will be the object returned from a call to `Tunnel#_makeChild`.
		 */
		_start: function () {
			function resolve() {
				clearHandles(handles);
				dfd.resolve();
			}

			var child = this._makeChild();
			var process = child.process;
			var dfd = child.deferred;
			var handles = [
				util.on(process.stdout, 'data', resolve),
				util.on(process.stderr, 'data', resolve),
				util.on(process, 'error', function (error) {
					clearHandles(handles);
					dfd.reject(error);
				})
			];

			return child;
		},

		/**
		 * Stops the tunnel.
		 *
		 * @returns {Promise.<integer>}
		 * A promise that resolves to the exit code for the tunnel once it has been terminated.
		 */
		stop: function () {
			if (this.isStopping) {
				throw new Error('Tunnel is already terminating');
			}
			else if (this.isStarting) {
				throw new Error('Tunnel is still launching');
			}
			else if (!this.isRunning) {
				throw new Error('Tunnel is not running');
			}

			this.isRunning = false;
			this.isStopping = true;

			var self = this;
			return this._stop().then(function (returnValue) {
				clearHandles(self._handles);
				self._process = self._handles = null;
				self.isRunning = self.isStopping = false;
				return returnValue;
			}, function (error) {
				self.isRunning = true;
				self.isStopping = false;
				throw error;
			});
		},

		/**
		 * This method provides the implementation that actually stops the tunnel.
		 *
		 * The default implementation that assumes the tunnel has been closed once the child process has exited. This
		 * method should be reimplemented by other tunnel launchers to implement correct shutdown logic, if necessary.
		 *
		 * @protected
		 * @returns {Promise.<void>} A promise that resolves once the tunnel has shut down.
		 */
		_stop: function () {
			var dfd = new Deferred();
			var process = this._process;

			process.once('exit', function (code) {
				dfd.resolve(code);
			});
			process.kill('SIGINT');

			return dfd.promise;
		}
	});

	return Tunnel;
});
