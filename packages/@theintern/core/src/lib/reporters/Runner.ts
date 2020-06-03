import charm from 'charm';
import { createCoverageMap, CoverageMap } from 'istanbul-lib-coverage';
import { Writable } from 'stream';

import Test from '../Test';
import Suite from '../Suite';
import { createEventHandler } from './Reporter';
import TextCoverage, { TextCoverageProperties } from './TextCoverage';
import Server from '../Server';
import { CoverageMessage, DeprecationMessage } from '../executors/Executor';
import Node, { NodeEvents, TunnelMessage } from '../executors/Node';
import { prefix } from '../common/util';

export type Charm = charm.CharmInstance;

const eventHandler = createEventHandler<NodeEvents>();

export default class Runner extends TextCoverage implements RunnerProperties {
  sessions: {
    [sessionId: string]: {
      coverage?: CoverageMap;
      suite?: Suite;
      [key: string]: any;
    };
  };

  hasRunErrors: boolean;
  hasSuiteErrors: boolean;
  hidePassed: boolean | string;
  hideSkipped: boolean | string;
  hideTunnelDownloadProgress: boolean;
  serveOnly: boolean;

  private _deprecationMessages: { [message: string]: boolean };
  private _needsNewline = false;

  protected charm: Charm;

  constructor(executor: Node, options: Partial<RunnerProperties> = {}) {
    super(executor, options);

    this.hidePassed = options.hidePassed || false;
    this.hideSkipped = options.hideSkipped || false;
    this.hideTunnelDownloadProgress =
      options.hideTunnelDownloadProgress || false;

    this.sessions = {};
    this.hasRunErrors = false;
    this.hasSuiteErrors = false;
    this.serveOnly = executor.config.serveOnly;

    this.charm = charm();
    this.charm.pipe(<Writable>this.output);
    this.charm.display('reset');

    this._deprecationMessages = {};
  }

  @eventHandler()
  coverage(message: CoverageMessage) {
    const sessionId = message.sessionId || '';

    // If coverage is emitted for functional suites but unit test suites
    // weren't run, there won't be an existing session for session ID ''
    // (the one used for unit tests and local functional tests)
    if (!this.sessions[sessionId]) {
      this.sessions[sessionId] = {};
    }
    const session = this.sessions[sessionId];
    session.coverage = session.coverage || createCoverageMap();
    session.coverage.merge(message.coverage);
  }

  @eventHandler()
  deprecated(message: DeprecationMessage) {
    // Keep track of deprecation messages we've seen before
    const key = `${message.original}|${message.replacement}|${message.message}`;
    if (this._deprecationMessages[key]) {
      return;
    }
    this._deprecationMessages[key] = true;

    this.charm
      .foreground('yellow')
      .write('⚠︎ ' + message.original + ' is deprecated. ');

    if (message.replacement) {
      this.charmWrite('Use ' + message.replacement + ' instead.');
    } else {
      this.charmWrite(
        'Please open a ticket at https://github.com/theintern/intern/issues if you still ' +
          'require access to this function.'
      );
    }

    if (message.message) {
      this.charmWrite(' ' + message.message);
    }

    this.charmWrite('\n');
    this.charm.display('reset');
  }

  @eventHandler()
  error(error: Error) {
    this.charm.foreground('red');
    this.charmWrite('(ノಠ益ಠ)ノ彡┻━┻\n');
    this.charmWrite(this.formatError(error));
    this.charm.display('reset');
    this.charmWrite('\n\n');
    this.hasRunErrors = true;
  }

  @eventHandler()
  warning(warning: string | Error) {
    this.charm.foreground('yellow');
    const message =
      typeof warning === 'string' ? warning : this.formatError(warning);
    this.charmWrite(`WARNING: ${message.replace(/^Error:\s+/, '')}`);
    this.charm.display('reset');
    this.charmWrite('\n\n');
  }

  @eventHandler()
  log(message: string) {
    message.split('\n').forEach((line) => {
      this.console.log(`DEBUG: ${line}`);
    });
  }

  @eventHandler()
  runEnd() {
    const map = this.executor.coverageMap;
    let numTests = 0;
    let numPassedTests = 0;
    let numFailedTests = 0;
    let numSkippedTests = 0;

    const sessionIds = Object.keys(this.sessions);
    const numEnvironments = sessionIds.length;

    // A session may contain only coverage data, so ensure that only those
    // with suites are considered
    sessionIds
      .filter((sessionId) => this.sessions[sessionId].suite)
      .forEach((sessionId) => {
        const suite = this.sessions[sessionId].suite!;
        numTests += suite.numTests;
        numPassedTests += suite.numPassedTests;
        numFailedTests += suite.numFailedTests;
        numSkippedTests += suite.numSkippedTests;
      });

    if (map.files().length > 0) {
      this.charmWrite('\n');
      this.charm.display('bright');
      this.charmWrite('Total coverage\n');
      this.charm.display('reset');
      this.createCoverageReport(this.reportType, map);
    }

    let message = `TOTAL: tested ${numEnvironments} platforms, ${numPassedTests} passed, ${numFailedTests} failed`;

    if (numSkippedTests) {
      message += `, ${numSkippedTests} skipped`;
    }

    const numUnrunTests =
      numTests - (numPassedTests + numFailedTests + numSkippedTests);
    if (numUnrunTests) {
      message += `, ${numUnrunTests} not run`;
    }

    if (this.hasRunErrors) {
      message += '; fatal error occurred';
    } else if (this.hasSuiteErrors) {
      message += '; suite error occurred';
    }

    this.charm.display('bright');
    this.charm.foreground(
      numFailedTests > 0 || this.hasRunErrors || this.hasSuiteErrors
        ? 'red'
        : 'green'
    );
    this.charmWrite(message);
    this.charm.display('reset');
    this.charmWrite('\n');
  }

  @eventHandler()
  serverStart(server: Server) {
    if (this.executor.config.serveOnly) {
      this.charmWrite(
        `To use the browser client, browse to\n\n  ${this.executor.config.serverUrl}__intern/\n\n`
      );
      this.charmWrite('Press CTRL-C to stop serving\n\n');
    } else {
      let message = `Listening on localhost:${server.port}`;
      if (server.socketPort) {
        message += ` (ws ${server.socketPort})`;
      }
      this.charmWrite(`${message}\n`);
    }
  }

  @eventHandler()
  suiteEnd(suite: Suite) {
    const session = this.sessions[suite.sessionId || ''];
    if (!session) {
      if (!this.serveOnly) {
        this.charm.display('bright');
        this.charm.foreground('yellow');
        this.charmWrite(
          'BUG: suiteEnd was received for invalid session ' + suite.sessionId
        );
        this.charm.display('reset');
        this.charmWrite('\n');
      }

      return;
    }

    if (suite.error) {
      const error = suite.error;

      this.charm.foreground('red');
      this.charmWrite(
        `Suite ${suite.id} ERROR${
          error.lifecycleMethod ? ` in ${error.lifecycleMethod}` : ''
        }\n`
      );
      this.charmWrite(this.formatError(error));
      this.charm.display('reset');
      this.charmWrite('\n');

      this.hasSuiteErrors = session.hasSuiteErrors = true;
    } else if (!suite.hasParent && this.executor.suites.length > 1) {
      if (session.coverage) {
        this.charmWrite('\n');
        this.createCoverageReport(this.reportType, session.coverage);
      } else {
        const charm = this.charm;
        this.charmWrite('No unit test coverage for ' + suite.name);
        charm.display('reset');
        this.charmWrite('\n');
      }

      const name = suite.name;
      const hasError = suite.error || session.hasSuiteErrors;
      const numTests = suite.numTests;
      const numFailedTests = suite.numFailedTests;
      const numSkippedTests = suite.numSkippedTests;
      const numPassedTests = numTests - numFailedTests - numSkippedTests;

      let summary = `${name}: ${numPassedTests} passed, ${numFailedTests} failed`;
      if (numSkippedTests) {
        summary += `, ${numSkippedTests} skipped`;
      }

      if (hasError) {
        summary += '; suite error occurred';
      }

      this.charm.display('bright');
      this.charm.foreground(numFailedTests || hasError > 0 ? 'red' : 'green');
      this.charmWrite(summary);
      this.charm.display('reset');
      this.charmWrite('\n');
    }
  }

  @eventHandler()
  suiteStart(suite: Suite) {
    if (!suite.hasParent) {
      this.sessions[suite.sessionId || ''] = { suite: suite };
      if (suite.sessionId) {
        this.charmWrite('\n');
        this.charmWrite(
          '‣ Created remote session ' +
            suite.name +
            ' (' +
            suite.sessionId +
            ')\n'
        );
      }
    }
  }

  @eventHandler()
  testEnd(test: Test) {
    const charm = this.charm;
    if (test.error) {
      charm.foreground('red');
      this.charmWrite('× ' + test.id);
      this.charmWrite(' (' + test.timeElapsed! / 1000 + 's)');
      this.charmWrite('\n');
      this.charmWrite(prefix(this.formatError(test.error), '    '));
      charm.display('reset');
      this.charmWrite('\n\n');
    } else if (test.skipped) {
      if (!this.hideSkipped) {
        this.charmWrite('~ ' + test.id);
        charm.display('reset');
        this.charmWrite(' (' + (test.skipped || 'skipped') + ')');
        charm.display('reset');
        this.charmWrite('\n');
      } else if (typeof this.hideSkipped === 'string') {
        this.charmWriteInline(this.hideSkipped);
      }
    } else {
      if (!this.hidePassed) {
        charm.foreground('green');
        this.charmWrite('✓ ' + test.id);
        charm.display('reset');
        this.charmWrite(' (' + test.timeElapsed! / 1000 + 's)');
        charm.display('reset');
        this.charmWrite('\n');
      } else if (typeof this.hidePassed === 'string') {
        this.charmWriteInline(this.hidePassed);
      }
    }
  }

  @eventHandler()
  tunnelDownloadProgress(message: TunnelMessage) {
    if (this.hideTunnelDownloadProgress) {
      return;
    }

    const progress = message.progress!;
    this.charmWrite(
      'Tunnel download: ' +
        ((progress.received / progress.total) * 100).toFixed(3) +
        '%\r'
    );
  }

  @eventHandler()
  tunnelStart() {
    this.charmWrite('Tunnel started\n');
  }

  @eventHandler()
  tunnelStatus(message: TunnelMessage) {
    this.charmWrite(message.status + '\x1b[K\r');
  }

  /**
   * Write to Charm, prefixing the output with a newline if necessary.
   */
  charmWrite(msg: string) {
    if (this._needsNewline) {
      this.charm.write('\n');
      this._needsNewline = false;
    }
    this.charm.write(msg);
  }

  /**
   * Write a message to Charm that doesn't end in a newline and that shouldn't
   * be prefixed with a newline.
   */
  charmWriteInline(msg: string) {
    this.charm.write(msg);
    this._needsNewline = true;
  }
}

export interface RunnerProperties extends TextCoverageProperties {
  hidePassed: boolean | string;
  hideSkipped: boolean | string;
  hideTunnelDownloadProgress: boolean;
}
