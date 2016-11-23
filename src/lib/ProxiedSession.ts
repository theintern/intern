import * as Promise from 'dojo/Promise';

import Session = require('dojo/has!host-node?dojo/node!leadfoot/Session');

/* istanbul ignore next: client-side code */
function getCoverageData(coverageVariable: string) {
	let coverageData = (function (this: any) { return this; })()[coverageVariable];
	return coverageData && JSON.stringify(coverageData);
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
export class ProxiedSession extends Session {
	/**
	 * Indicate whether coverage data should be requested before performing a request.
	 *
	 * @type {boolean}
	 */
	coverageEnabled = false;

	/**
	 * The name of the global variable used to store coverage data.
	 *
	 * @type {string}
	 */
	coverageVariable = '';

	/**
	 * The number of characters that need to be truncated from the front of file paths to get a working path-part
	 * for a URL.
	 *
	 * @type {number}
	 */
	proxyBasePathLength = 0;

	/**
	 * The base URL of the proxy server in use.
	 *
	 * @type {string}
	 */
	proxyUrl = '';

	reporterManager: any;

	private _heartbeatIntervalHandle: { remove: Function };

	/**
	 * Navigates the browser to a new URL like {@link module:leadfoot/Session#get}, but retrieves any code coverage
	 * data recorded by the browser prior to navigation.
	 */
	get(url: string): Promise<any> {
		let args = Array.prototype.slice.call(arguments, 0);

		// At least two letters are required in the scheme to avoid Windows paths being misinterpreted as URLs
		if (!/^[A-Za-z][A-Za-z0-9+.-]+:/.test(args[0])) {
			args[0] = this.proxyUrl + args[0].slice(this.proxyBasePathLength);
		}

		if (this.coverageEnabled) {
			let promise: Promise<any>;

			// At least Safari will not inject user scripts for non http/https URLs, so we can't get coverage data.
			if (this.capabilities.brokenExecuteForNonHttpUrl) {
				promise = this.getCurrentUrl().then(function (url) {
					return (/^https?:/i).test(url);
				});
			}
			else {
				promise = Promise.resolve(true);
			}

			return promise.then((shouldGetCoverage) => {
				if (shouldGetCoverage) {
					return this.execute<string>(getCoverageData, [ this.coverageVariable ]).then((coverageData) => {
						return coverageData &&
							this.reporterManager.emit('coverage', this.sessionId, JSON.parse(coverageData));
					});
				}
			}).finally(() => {
				return super.get.apply(this, args);
			});
		}

		return super.get.apply(this, args);
	}

	/**
	 * Quits the browser like {@link module:leadfoot/Session#quit}, but retrieves any code coverage data recorded
	 * by the browser prior to quitting.
	 */
	quit(): Promise<any> {
		return this
			.setHeartbeatInterval(0)
			.then(() => {
				if (this.coverageEnabled) {
					return this.execute<string>(getCoverageData, [ this.coverageVariable ]).then((coverageData) => {
						return coverageData &&
							this.reporterManager.emit('coverage', this.sessionId, JSON.parse(coverageData));
					});
				}
			})
			.finally(() => {
				return super.quit();
			});
	}

	/**
	 * Sets up a timer to send no-op commands to the remote server on an interval to prevent long-running unit tests
	 * from causing the session to time out.
	 *
	 * @param delay Amount of time to wait between heartbeats. Setting the delay to 0 will disable heartbeats.
	 */
	setHeartbeatInterval(delay: number): Promise<any> {
		this._heartbeatIntervalHandle && this._heartbeatIntervalHandle.remove();

		if (delay) {
			// A heartbeat command is sent immediately when the interval is set because it is unknown how long ago
			// the last command was sent and it simplifies the implementation by requiring only one call to
			// `setTimeout`
			const self = this;
			(function sendHeartbeat() {
				let timeoutId: number;
				let cancelled = false;
				let startTime = Date.now();

				self._heartbeatIntervalHandle = {
					remove: function () {
						cancelled = true;
						clearTimeout(timeoutId);
					}
				};

				self.getCurrentUrl().then(function () {
					if (!cancelled) {
						timeoutId = <number> (<any> setTimeout(sendHeartbeat, delay - (Date.now() - startTime)));
					}
				});
			})();
		}

		return Promise.resolve();
	}
}
