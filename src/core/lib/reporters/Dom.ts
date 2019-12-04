import { global } from '../../../common';
import { Executor } from '../executors/Executor';
import Reporter, { eventHandler, ReporterProperties } from './Reporter';
import Suite from '../Suite';
import Test from '../Test';

/**
 * The Dom reporter outputs text into the DOM, essentially treating it like the
 * console.
 */
export default class Dom extends Reporter {
  document: HTMLDocument;

  suiteNode: HTMLElement;

  testNode: HTMLElement | undefined;

  constructor(executor: Executor, options: DomOptions = {}) {
    super(executor, options);
    this.document = options.document || document;
    this.suiteNode = options.suiteNode || this.document.body;
  }

  @eventHandler()
  error(error: Error) {
    const errorNode = this.document.createElement('pre');
    errorNode.appendChild(
      this.document.createTextNode(this.formatError(error))
    );
    this.document.body.appendChild(errorNode);
  }

  @eventHandler()
  suiteEnd(suite: Suite) {
    this.suiteNode = <HTMLElement>(
      (this.suiteNode!.parentNode!.parentNode || this.document.body)
    );

    if (suite.error) {
      this.suiteNode.appendChild(
        this.document.createTextNode('Suite "' + suite.id + '" failed')
      );
      this.suiteNode.style.color = 'red';

      const errorNode = this.document.createElement('pre');
      errorNode.appendChild(
        this.document.createTextNode(this.formatError(suite.error))
      );
      this.suiteNode.appendChild(errorNode);
      this._scroll();
    }
  }

  @eventHandler()
  suiteStart(suite: Suite) {
    const oldSuiteNode = this.suiteNode;
    this.suiteNode = this.document.createElement('ol');

    if (oldSuiteNode === this.document.body) {
      oldSuiteNode.appendChild(this.suiteNode);
    } else {
      const outerSuiteNode = this.document.createElement('li');
      const headerNode = this.document.createElement('div');

      headerNode.appendChild(this.document.createTextNode(suite.name!));
      outerSuiteNode.appendChild(headerNode);
      outerSuiteNode.appendChild(this.suiteNode);
      oldSuiteNode.appendChild(outerSuiteNode);
    }

    this._scroll();
  }

  @eventHandler()
  testEnd(test: Test) {
    if (test.skipped) {
      const testNode = (this.testNode = this.document.createElement('li'));
      testNode.appendChild(
        this.document.createTextNode(
          test.name +
            ' skipped' +
            (test.skipped ? ' (' + test.skipped + ')' : '')
        )
      );
      testNode.style.color = 'gray';
      this.suiteNode.appendChild(testNode);
    } else if (test.error) {
      const testNode = this.testNode!;
      testNode.appendChild(
        this.document.createTextNode(' failed (' + test.timeElapsed + 'ms)')
      );
      testNode.style.color = 'red';

      const errorNode = this.document.createElement('pre');
      errorNode.appendChild(
        this.document.createTextNode(this.formatError(test.error))
      );
      testNode.appendChild(errorNode);
    } else {
      const testNode = this.testNode!;
      testNode.appendChild(
        this.document.createTextNode(' passed (' + test.timeElapsed + 'ms)')
      );
      testNode.style.color = 'green';
    }
    this._scroll();
  }

  @eventHandler()
  testStart(test: Test) {
    this.testNode = this.document.createElement('li');
    this.testNode.appendChild(this.document.createTextNode(test.name));
    this.suiteNode.appendChild(this.testNode);
    this._scroll();
  }

  private _scroll() {
    global.scrollTo(
      0,
      this.document.documentElement!.scrollHeight ||
        this.document.body.scrollHeight
    );
  }
}

export interface DomProperties extends ReporterProperties {
  document: Document;
  suiteNode: HTMLElement;
}

export type DomOptions = Partial<DomProperties>;
