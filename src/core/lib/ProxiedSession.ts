import Session from '../../webdriver/Session';
import { Task, CancellablePromise } from '../..//common';
import Node from './executors/Node';

/* istanbul ignore next: client-side code */
function getCoverageData(coverageVariable: string) {
  let coverageData = (function(this: any) {
    return this;
  })()[coverageVariable];
  return coverageData && JSON.stringify(coverageData);
}

/**
 * A ProxiedSession object represents a WebDriver session that interacts with
 * the Intern instrumenting server. It collects code instrumentation data from
 * pages and converts local filesystem paths into URLs for use with
 * `leadfoot/Session#get`.
 */
export default class ProxiedSession extends Session {
  /**
   * The base URL for relative URLs.
   */
  baseUrl = '';

  /**
   * The name of the global variable used to store coverage data.
   */
  coverageVariable = '';

  /**
   * The Executor hosting this session.
   */
  executor!: Node;

  private _heartbeatIntervalHandle: { remove: Function } | undefined;

  get coverageEnabled() {
    return this.executor.config.coverage !== false;
  }

  /**
   * Navigates the browser to a new URL like `leadfoot/Session#get`, but
   * retrieves any code coverage data recorded by the browser prior to
   * navigation.
   */
  get(url: string) {
    // At least two letters are required in the scheme to avoid Windows
    // paths being misinterpreted as URLs
    if (!/^[A-Za-z][A-Za-z0-9+.-]+:/.test(url)) {
      if (url.indexOf(this.executor.config.basePath) === 0) {
        url = url.slice(this.executor.config.basePath.length);
      }

      url = this.baseUrl + url;
    }

    if (!this.coverageEnabled) {
      return super.get(url);
    }

    return this._getCoverage().finally(() => {
      return super.get(url);
    });
  }

  /**
   * Quits the browser like `leadfoot/Session#quit`, but retrieves any code
   * coverage data recorded by the browser prior to quitting.
   */
  quit() {
    this.executor.log('Quitting', this.sessionId);
    return this.setHeartbeatInterval(0)
      .then(() => {
        if (this.coverageEnabled) {
          return this._getCoverage();
        }
      })
      .finally(() => super.quit());
  }

  /**
   * Sets up a timer to send no-op commands to the remote server on an
   * interval to prevent long-running unit tests from causing the session to
   * time out.
   *
   * @param delay Amount of time to wait between heartbeats. Setting the delay
   * to 0 will disable heartbeats.
   */
  setHeartbeatInterval(delay: number): CancellablePromise<void> {
    this._heartbeatIntervalHandle && this._heartbeatIntervalHandle.remove();

    if (delay) {
      // A heartbeat command is sent immediately when the interval is set
      // because it is unknown how long ago the last command was sent and
      // it simplifies the implementation by requiring only one call to
      // `setTimeout`
      const sendHeartbeat = () => {
        let timeoutId: NodeJS.Timer;
        let cancelled = false;
        let startTime = Date.now();

        this._heartbeatIntervalHandle = {
          remove: function() {
            cancelled = true;
            clearTimeout(timeoutId);
          }
        };

        this.getCurrentUrl()
          .then(() => {
            if (!cancelled) {
              timeoutId = global.setTimeout(
                sendHeartbeat,
                delay - (Date.now() - startTime)
              );
            }
          })
          .catch(error => this.executor.emit('error', error));
      };

      sendHeartbeat();
    }

    return Task.resolve();
  }

  protected _getCoverage() {
    let shouldGetPromise: CancellablePromise<boolean>;

    // At least Safari 9 will not inject user scripts for non http/https
    // URLs, so we can't get coverage data.
    if (this.capabilities.brokenExecuteForNonHttpUrl) {
      shouldGetPromise = Task.resolve(
        this.getCurrentUrl().then(url => /^https?:/i.test(url))
      );
    } else {
      shouldGetPromise = Task.resolve(true);
    }

    return shouldGetPromise.then(shouldGetCoverage => {
      if (shouldGetCoverage) {
        return this.execute<string>(getCoverageData, [
          this.coverageVariable
        ]).then(coverageData => {
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
