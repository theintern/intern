import Session from '@theintern/leadfoot/Session';
import Task from '@dojo/core/async/Task';
import Node from './executors/Node';

/* istanbul ignore next: client-side code */
function getCoverageData(coverageVariable: string) {
	let coverageData = (function (this: any) { return this; })()[coverageVariable];
	return coverageData && JSON.stringify(coverageData);
}

/**
 * A ProxiedSession object represents a WebDriver session that interacts with the Intern instrumenting server. It
 * collects code instrumentation data from pages and converts local filesystem paths into URLs for use with
 * {@link module:leadfoot/Session#get}.
 */
export default class ProxiedSession extends Session {
	/**
	 * Indicate whether coverage data should be requested before performing a request.
	 */
	coverageEnabled = false;

	/**
	 * The name of the global variable used to store coverage data.
	 */
	coverageVariable = '';

	/**
	 * The Executor hosting this session.
	 */
	executor: Node;

	/**
	 * The number of characters that need to be truncated from the front of file paths to get a working path-part
	 * for a URL.
	 */
	serverBasePathLength = 0;

	/**
	 * The base URL of the server server in use.
	 */
	serverUrl = '';

	private _heartbeatIntervalHandle: { remove: Function };

	/**
	 * Navigates the browser to a new URL like {@link module:leadfoot/Session#get}, but retrieves any code coverage
	 * data recorded by the browser prior to navigation.
	 */
	get(url: string) {
		// At least two letters are required in the scheme to avoid Windows paths being misinterpreted as URLs
		if (!/^[A-Za-z][A-Za-z0-9+.-]+:/.test(url)) {
			if (url.indexOf(this.executor.config.basePath) === 0) {
				url = url.slice(this.serverBasePathLength);
			}

			url = this.serverUrl + url;
		}

		if (!this.coverageEnabled) {
			return super.get(url);
		}

		return this._getCoverage().finally(() => {
			return super.get(url);
		});
	}

	/**
	 * Quits the browser like {@link module:leadfoot/Session#quit}, but retrieves any code coverage data recorded
	 * by the browser prior to quitting.
	 */
	quit() {
		this.executor.log('Quitting', this.sessionId);
		return this
			.setHeartbeatInterval(0)
			.then(() => {
				if (this.coverageEnabled) {
					return this._getCoverage();
				}
			})
			.finally(() => super.quit());
	}

	/**
	 * Sets up a timer to send no-op commands to the remote server on an interval to prevent long-running unit tests
	 * from causing the session to time out.
	 *
	 * @param delay Amount of time to wait between heartbeats. Setting the delay to 0 will disable heartbeats.
	 */
	setHeartbeatInterval(delay: number) {
		this._heartbeatIntervalHandle && this._heartbeatIntervalHandle.remove();

		if (delay) {
			// A heartbeat command is sent immediately when the interval is set because it is unknown how long ago
			// the last command was sent and it simplifies the implementation by requiring only one call to
			// `setTimeout`
			const sendHeartbeat = () => {
				let timeoutId: NodeJS.Timer;
				let cancelled = false;
				let startTime = Date.now();

				this._heartbeatIntervalHandle = {
					remove: function () {
						cancelled = true;
						clearTimeout(timeoutId);
					}
				};

				this.getCurrentUrl().then(() => {
					if (!cancelled) {
						timeoutId = setTimeout(sendHeartbeat, delay - (Date.now() - startTime));
					}
				}).catch(error => this.executor.emit('error', error));
			};

			sendHeartbeat();
		}

		return Task.resolve();
	}

	protected _getCoverage() {
		let shouldGetPromise: Task<boolean>;

		// At least Safari 9 will not inject user scripts for non http/https URLs, so we can't get coverage data.
		if (this.capabilities.brokenExecuteForNonHttpUrl) {
			shouldGetPromise = Task.resolve(this.getCurrentUrl().then(url => (/^https?:/i).test(url)));
		}
		else {
			shouldGetPromise = Task.resolve(true);
		}

		return shouldGetPromise.then(shouldGetCoverage => {
			if (shouldGetCoverage) {
				return this.execute<string>(getCoverageData, [this.coverageVariable]).then(coverageData => {
					// Emit coverage retrieved from a remote session
					this.executor.log('Got coverage data for', this.sessionId);
					if (coverageData) {
						return this.executor.emit('coverage', {
							sessionId: this.sessionId,
							source: 'remote session',
							coverage: JSON.parse(coverageData)
						});
					}
				});
			}
		});
	}
}
