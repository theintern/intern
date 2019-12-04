import charm from 'charm';
import { createCoverageMap, CoverageMap } from 'istanbul-lib-coverage';
import { format } from 'util';
import { global } from '../../../common';

import Environment from '../Environment';
import Suite from '../Suite';
import Test from '../Test';
import RemoteSuite from '../RemoteSuite';
import { createEventHandler } from './Reporter';
import TextCoverage, { TextCoverageProperties } from './TextCoverage';
import { CoverageMessage, DeprecationMessage } from '../executors/Executor';
import Node, { NodeEvents, TunnelMessage } from '../executors/Node';

const eventHandler = createEventHandler<NodeEvents>();

/**
 * Handles presentation of runner results to the user
 */
export default class Pretty extends TextCoverage implements PrettyProperties {
  colorReplacement: { [key: string]: string };
  dimensions: any;
  titleWidth: number;
  maxProgressBarWidth: number;
  tunnelState: string;

  protected _header: string;
  protected _log: string[];
  protected _reports: any;
  protected _spinnerOffset: number;
  protected _total: Report;
  protected _charm: charm.CharmInstance | undefined;
  protected _renderTimeout: NodeJS.Timer | undefined;

  constructor(executor: Node, options: PrettyOptions = {}) {
    super(executor, options);

    this._spinnerOffset = 0;
    this.dimensions = options.dimensions || {};
    this.titleWidth = options.titleWidth || 12;
    this.maxProgressBarWidth = options.maxProgressBarWidth || 40;
    this.colorReplacement = Object.assign(
      {
        0: 'green',
        1: 'magenta',
        2: 'red',
        '✓': 'green',
        '!': 'red',
        '×': 'red',
        '~': 'magenta',
        '⚠': 'yelow'
      },
      options.colorReplacement || {}
    );
    this._header = '';
    this._reports = {};
    this._log = [];
    this.tunnelState = '';
    this._total = new Report();
  }

  close() {
    if (this._renderTimeout) {
      clearTimeout(this._renderTimeout);
    }
  }

  @eventHandler()
  runStart() {
    this._header = this.executor.config.name;
    this._charm = this._charm || this._newCharm();

    const resize = () => {
      this.dimensions.width = (<any>global.process.stdout).columns || 80;
      this.dimensions.height = (<any>global.process.stdout).rows || 24;
    };

    resize();
    global.process.stdout.on('resize', resize);

    const rerender = () => {
      this._charm!.erase('screen').position(0, 0);
      this._render();
      this._renderTimeout = global.setTimeout(rerender, 200);
    };
    rerender();
  }

  @eventHandler()
  runEnd() {
    const charm = this._charm!;
    global.clearTimeout(this._renderTimeout);
    charm.erase('screen').position(0, 0);

    // write a full log of errors
    // Sort logs: pass < deprecated < skip < errors < fail
    const ERROR_LOG_WEIGHT: { [key: string]: number } = {
      '✓': 0,
      '⚠': 1,
      '~': 2,
      '×': 3,
      '!': 4
    };
    this._log
      .sort((a: any, b: any) => {
        a = ERROR_LOG_WEIGHT[a.charAt(0)] || 0;
        b = ERROR_LOG_WEIGHT[b.charAt(0)] || 0;
        return a - b;
      })
      .forEach(line => {
        const color = this._getColor(line);
        if (color == null) {
          charm.display('reset');
        } else {
          charm.foreground(color);
        }
        charm.write(`${line}\n`);
      });
    charm.display('reset');
    charm.write('\n');

    // Display the pretty results
    this._render(true);

    // Display coverage information
    if (this._total.coverageMap.files().length > 0) {
      charm.write('\n');
      this.createCoverageReport('text', this._total.coverageMap);
    }
  }

  @eventHandler()
  coverage(data: CoverageMessage) {
    const report = this._reports[data.sessionId || ''];
    report && report.coverageMap.merge(data.coverage);
    this._total.coverageMap.merge(data.coverage);
  }

  @eventHandler()
  suiteStart(suite: Suite) {
    if (!suite.hasParent || suite instanceof RemoteSuite) {
      const numTests = suite.numTests;
      this._total.numTotal += numTests;

      if (suite.sessionId) {
        const report = this._getReport(suite);
        report.numTotal += numTests;
        report.suiteInfo[suite.id] = {
          parentId: suite.parentId,
          numToReport: suite.numTests
        };
      }
    }
  }

  @eventHandler()
  suiteEnd(suite: Suite) {
    if (suite.error) {
      // Record all the tests that haven't been run as skipped
      const info = this._getReport(suite).suiteInfo[suite.id];
      this._record(suite, Result.SKIP, info.numToReport);

      const message = '! ' + suite.id;
      this._log.push(message + '\n' + this.formatError(suite.error));
    }
  }

  @eventHandler()
  testEnd(test: Test) {
    if (test.skipped) {
      this._record(test, Result.SKIP);
      this._log.push('~ ' + test.id + ': ' + (test.skipped || 'skipped'));
    } else if (test.error) {
      const message = '× ' + test.id;
      this._record(test, Result.FAIL);
      this._log.push(message + '\n' + this.formatError(test.error));
    } else {
      this._record(test, Result.PASS);
      this._log.push('✓ ' + test.id);
    }
  }

  @eventHandler()
  tunnelDownloadProgress(message: TunnelMessage) {
    const progress = message.progress!;
    this.tunnelState =
      'Downloading ' +
      ((progress.received / progress.total) * 100).toFixed(2) +
      '%';
  }

  @eventHandler()
  tunnelStatus(message: TunnelMessage) {
    this.tunnelState = message.status!;
  }

  @eventHandler()
  error(error: Error) {
    const message = '! ' + error.message;
    this._log.push(message + '\n' + this.formatError(error));
    // stop the render timeout on a fatal error so Intern can exit
    global.clearTimeout(this._renderTimeout);
  }

  @eventHandler()
  deprecated(message: DeprecationMessage) {
    let text = '⚠ ' + message.original + ' is deprecated.';

    if (message.replacement) {
      text += ' Use ' + message.replacement + ' instead.';
    }

    if (message.message) {
      text += ' ' + message.message;
    }

    this._log.push(text);
  }

  /**
   * Return the report for a given session, creating it if necessary.
   */
  private _getReport(suiteOrTest: Suite | Test): Report {
    const id = suiteOrTest.sessionId || '';
    if (!this._reports[id]) {
      this._reports[id] = new Report(
        suiteOrTest.remote && suiteOrTest.remote.environmentType
      );
    }
    return this._reports[id];
  }

  /**
   * Create the charm instance used by this report.
   */
  private _newCharm() {
    const c = charm();
    c.pipe(global.process.stdout);
    return c;
  }

  private _record(suiteOrTest: Suite | Test, result: Result, count = 1) {
    const report = this._reports[suiteOrTest.sessionId];
    this._total.record(result, count);
    if (report) {
      report.record(result, count);

      const suiteInfo = report.suiteInfo;
      let info: SuiteInfo | undefined = suiteInfo[suiteOrTest.id];
      // A test ID won't be in this._suiteInfo, but it's parentId should be
      if (!info && suiteOrTest.parentId) {
        info = suiteInfo[suiteOrTest.parentId];
      }
      while (info) {
        info.numToReport -= count;
        if (info.parentId) {
          info = suiteInfo[info.parentId];
        } else {
          info = undefined;
        }
      }
    }
  }

  /**
   * Render the progress bar
   * [✔︎~✔︎×✔︎✔︎✔︎✔︎✔︎✔︎] 99/100
   * @param report the report data to render
   * @param width the maximum width for the entire progress bar
   */
  private _drawProgressBar(report: Report, width: number) {
    const spinnerCharacter = SPINNER_STATES[this._spinnerOffset];
    const charm = this._charm!;
    if (!report.numTotal) {
      charm.write('Pending');
      return;
    }

    const totalTextSize = String(report.numTotal).length;
    const remainingWidth = Math.max(width - 4 - totalTextSize * 2, 1);
    const barSize = Math.min(
      remainingWidth,
      report.numTotal,
      this.maxProgressBarWidth
    );
    const results = report.getCompressedResults(barSize);

    charm.write('[');
    results.forEach(value => {
      const color = this._getColor(value);
      if (color == null) {
        charm.display('reset');
      } else {
        charm.foreground(color);
      }
      charm.write(symbols[value]);
    });
    charm.display('reset');
    charm.write(
      fit(spinnerCharacter, barSize - results.length) +
        '] ' +
        fit(report.finished, totalTextSize, true) +
        '/' +
        report.numTotal
    );
  }

  /**
   * Render a single line
   * TITLE:        [✔︎~✔︎×✔︎✔︎✔︎✔︎✔︎✔︎] 100/100, 2 fail, 1 skip
   * TODO split this into two lines. The first line will display the
   * title, OS and code coverage and the progress bar on the second
   */
  private _drawSessionReport(report: Report) {
    const charm = this._charm!;
    const titleWidth = this.titleWidth;
    const leftOfBar = fit(
      this._abbreviateEnvironment(report.environment).slice(0, titleWidth - 2) +
        ': ',
      titleWidth
    );
    const rightOfBar =
      '' +
      (report.numFailed ? ', ' + report.numFailed + ' fail' : '') +
      (report.numSkipped ? ', ' + report.numSkipped + ' skip' : '');
    const barWidth = this.dimensions.width - rightOfBar.length - titleWidth;

    charm.write(leftOfBar);
    this._drawProgressBar(report, barWidth);
    charm.write(rightOfBar + '\n');
  }

  /**
   * Abbreviate the environment information for rendering
   * @param env the test environment
   * @returns {string} abbreviated environment information
   */
  private _abbreviateEnvironment(env: any): string {
    const browser =
      (<{ [key: string]: any }>BROWSERS)[env.browserName.toLowerCase()] ||
      env.browserName.slice(0, 4);
    const result = [browser];

    if (env.version) {
      let version = String(env.version);
      if (version.indexOf('.') > -1) {
        version = version.slice(0, version.indexOf('.'));
      }
      result.push(version);
    }

    if (env.platform) {
      result.push(env.platform.slice(0, 3));
    }

    return result.join(' ');
  }

  private _render(omitLogs: boolean = false) {
    const charm = this._charm!;
    const numReports = Object.keys(this._reports).length;
    const logLength =
      this.dimensions.height -
      numReports -
      4 /* last line & total */ -
      (this.tunnelState ? 2 : 0) -
      (numReports ? 1 : 0) -
      (this._header ? 1 : 0);
    this._spinnerOffset = ++this._spinnerOffset % SPINNER_STATES.length;

    charm.display('reset');
    if (this._header) {
      charm.display('bright');
      charm.write(this._header + '\n');
      charm.display('reset');
    }
    this.tunnelState && charm.write('Tunnel: ' + this.tunnelState + '\n\n');
    this._drawTotalReport(this._total);

    // TODO if there is not room to render all reports only render
    // active ones or only the total with less space
    if (numReports) {
      charm.write('\n');
      for (let key in this._reports) {
        this._drawSessionReport(this._reports[key]);
      }
    }

    if (!omitLogs && logLength > 0 && this._log.length) {
      const allowed = { '×': true, '⚠': true, '!': true };
      charm.write('\n');

      this._log
        .filter(line => {
          return (<{ [key: string]: any }>allowed)[line.charAt(0)];
        })
        .slice(-logLength)
        .forEach(line => {
          // truncate long lines
          const color = this._getColor(line);
          if (color) {
            charm.foreground(color);
          }
          line = line.split('\n', 1)[0];
          charm.write(`${line.slice(0, this.dimensions.width)}\n`);
          charm.display('reset');
        });
    }
  }

  private _drawTotalReport(report: Report) {
    const charm = this._charm!;
    const title = 'Total: ';
    const totalTextSize = String(report.numTotal).length;

    charm.write(title);
    this._drawProgressBar(report, this.dimensions.width - title.length);
    charm.write(
      format(
        '\nPassed: %s  Failed: %s  Skipped: %d\n',
        fit(report.numPassed, totalTextSize),
        fit(report.numFailed, totalTextSize),
        report.numSkipped
      )
    );
  }

  private _getColor(value: string | number): charm.CharmColor | null {
    if (typeof value === 'string') {
      value = value[0];
    }
    return <charm.CharmColor>this.colorReplacement[value] || null;
  }
}

export interface PrettyProperties extends TextCoverageProperties {
  colorReplacement: { [key: string]: string };
  dimensions: any;
  maxProgressBarWidth: number;
  titleWidth: number;
}

export type PrettyOptions = Partial<PrettyProperties>;

/**
 * Model tracking test results
 * @param environment the environment associated with the report
 * @param sessionId the sessionId associated with the report
 */
export class Report {
  environment: Environment | undefined;
  sessionId: string | undefined;
  numTotal = 0;
  numPassed = 0;
  numFailed = 0;
  numSkipped = 0;
  results: number[] = [];
  suiteInfo: { [id: string]: SuiteInfo };
  coverageMap: CoverageMap;

  constructor(environment?: Environment, sessionId?: string) {
    this.environment = environment;
    this.sessionId = sessionId;
    this.coverageMap = createCoverageMap();
    this.suiteInfo = {};
  }

  get finished() {
    return this.results.length;
  }

  record(result: Result, count = 1) {
    for (let i = 0; i < count; i++) {
      this.results.push(result);
    }

    switch (result) {
      case Result.PASS:
        this.numPassed += count;
        break;
      case Result.SKIP:
        this.numSkipped += count;
        break;
      case Result.FAIL:
        this.numFailed += count;
        break;
    }
  }

  getCompressedResults(maxWidth: number): number[] {
    const total = Math.max(this.numTotal, this.results.length);
    const width = Math.min(maxWidth, total);
    const resultList: Result[] = [];

    for (let i = 0; i < this.results.length; ++i) {
      const pos = Math.floor((i / total) * width);
      resultList[pos] = Math.max(
        resultList[pos] || Result.PASS,
        this.results[i]
      );
    }

    return resultList;
  }
}

export enum Result {
  PASS = 0,
  SKIP = 1,
  FAIL = 2
}

export interface SuiteInfo {
  parentId: string | undefined;
  numToReport: number;
}

const symbols = ['✓', '~', '×'];
const PAD = new Array(100).join(' ');
const SPINNER_STATES = ['/', '-', '\\', '|'];
const BROWSERS = {
  chrome: 'Chr',
  firefox: 'Fx',
  opera: 'O',
  safari: 'Saf',
  'internet explorer': 'IE',
  phantomjs: 'Phan'
};

function pad(width: number): string {
  return PAD.slice(0, Math.max(width, 0));
}

function fit(
  text: string | number,
  width: number,
  padLeft: boolean = false
): string {
  text = String(text);
  if (text.length < width) {
    if (padLeft) {
      return pad(width - text.length) + text;
    }
    return text + pad(width - text.length);
  }
  return text.slice(0, width);
}
