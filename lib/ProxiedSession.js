define([
	'dojo/lang',
	'dojo/node!leadfoot/Session',
	'dojo/topic',
	'dojo/Deferred'
], function (lang, Session, topic, Deferred) {
	/* istanbul ignore next: client-side code */
	function getCoverageData() {
		/*global __internCoverage:false */
		return typeof __internCoverage !== 'undefined' && JSON.stringify(__internCoverage);
	}

	function publishCoverageData(sessionId, coverageData) {
		coverageData && topic.publish('/coverage', sessionId, JSON.parse(coverageData));
	}

	/**
	 * A ProxiedSession object represents a WebDriver session that interacts with the Intern instrumenting proxy. It
	 * collects code instrumentation data from pages and converts local filesystem paths into URLs for use with
	 * {@link module:leadfoot/Session#get}.
	 *
	 * @constructor module:intern/lib/ProxiedSession
	 * @extends module:leadfoot/Session
	 * @param {string} sessionId The ID of the session, as provided by the remote.
	 * @param {module:leadfoot/Server} server The server that the session belongs to.
	 * @param {Object} capabilities A map of bugs and features that the remote environment exposes.
	 */
	function ProxiedSession() {
		Session.apply(this, arguments);
	}

	ProxiedSession.prototype = Object.create(Session.prototype);
	lang.mixin(ProxiedSession.prototype, /** @lends module:leadfoot/ProxiedSession# */ {
		constructor: ProxiedSession,

		/**
		 * The number of characters that need to be truncated from the front of file paths to get a working path-part
		 * for a URL.
		 *
		 * @type {number}
		 */
		proxyBasePathLength: 0,

		/**
		 * The base URL of the proxy server in use.
		 *
		 * @type {string}
		 */
		proxyUrl: '',

		/**
		 * Indicate whether coverage data should be requested before performing a request.
		 *
		 * @type {boolean}
		 */
		coverageEnabled: false,

		_heartbeatIntervalHandle: null,

		/**
		 * Navigates the browser to a new URL like {@link module:leadfoot/Session#get}, but retrieves any code coverage
		 * data recorded by the browser prior to navigation.
		 *
		 * @param {string} url
		 * @returns {Promise.<void>}
		 */
		get: function () {
			var self = this,
				args = Array.prototype.slice.call(arguments, 0);

			// At least two letters are required in the scheme to avoid Windows paths being misinterpreted as URLs
			if (!/^[A-Za-z][A-Za-z0-9+.-]+:/.test(args[0])) {
				args[0] = this.proxyUrl + args[0].slice(this.proxyBasePathLength);
			}

			if (this.coverageEnabled) {
				return this.execute(getCoverageData)
					.then(function (coverageData) {
						return publishCoverageData(self.sessionId, coverageData);
					}).then(function () {
						return Session.prototype.get.apply(self, args);
					});
			}
			else {
				return Session.prototype.get.apply(self, args);
			}
		},

		/**
		 * Quits the browser like {@link module:leadfoot/Session#quit}, but retrieves any code coverage data recorded
		 * by the browser prior to quitting.
		 *
		 * @returns {Promise.<void>}
		 */
		quit: function () {
			var self = this;
			return this.setHeartbeatInterval(0)
				.then(function () {
					return self.execute(getCoverageData);
				})
				.then(function (coverageData) {
					return publishCoverageData(self.sessionId, coverageData);
				})
				.then(function () {
					return Session.prototype.quit.call(self);
				});
		},

		/**
		 * Sets up a timer to send no-op commands to the remote server on an interval to prevent long-running unit tests
		 * from causing the session to time out.
		 *
		 * @param {number} delay
		 * Amount of time to wait between heartbeats. Setting the delay to 0 will disable heartbeats.
		 *
		 * @returns {Promise.<void>}
		 */
		setHeartbeatInterval: function (delay) {
			this._heartbeatIntervalHandle && this._heartbeatIntervalHandle.remove();

			if (delay) {
				// A heartbeat command is sent immediately when the interval is set because it is unknown how long ago
				// the last command was sent and it simplifies the implementation by requiring only one call to
				// `setTimeout`
				var self = this;
				(function sendHeartbeat() {
					var timeoutId,
						cancelled = false,
						startTime = Date.now();

					self._heartbeatIntervalHandle = {
						remove: function () {
							cancelled = true;
							clearTimeout(timeoutId);
						}
					};

					self.getCurrentUrl().then(function () {
						if (!cancelled) {
							timeoutId = setTimeout(sendHeartbeat, delay - (Date.now() - startTime));
						}
					});
				})();
			}

			var dfd = new Deferred();
			dfd.resolve();
			return dfd.promise;
		}
	});

	return ProxiedSession;
});
