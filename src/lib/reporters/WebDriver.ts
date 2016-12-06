import * as Promise from 'dojo/Promise';
import * as sendData from '../sendData';
import * as util from '../util';
import { IRequire } from 'dojo/loader';
import { Reporter, ReporterConfig, Config } from '../../interfaces';
import Suite from '../Suite';
import Test from '../Test';

declare const require: IRequire;

function scroll(): void {
	window.scrollTo(0, document.documentElement.scrollHeight || document.body.scrollHeight);
}

export interface WebDriverReporterConfig extends ReporterConfig {
	writeHtml?: boolean;
	sessionId?: string;
	internConfig?: Config;
	waitForRunner?: boolean;
	maxPostSize?: number;
}

export default class WebDriver implements Reporter {
	url: string;
	writeHtml: boolean;
	sessionId: string;
	waitForRunner: boolean;
	suiteNode: HTMLElement;
	testNode: HTMLElement;

	constructor(config: WebDriverReporterConfig = {}) {
		this.url = require.toUrl('intern/');
		this.writeHtml = config.writeHtml !== false;
		this.sessionId = config.internConfig.sessionId;
		this.waitForRunner = config.waitForRunner;

		if (config.maxPostSize != null) {
			sendData.setMaxPostSize(config.maxPostSize);
		}

		if (this.writeHtml) {
			this.suiteNode = document.body;
		}
	}

	$others(name: string, ...args: any[]): Promise<any> {
		if (name !== 'coverage' && name !== 'run') {
			return this._sendEvent(name, args);
		}
	}

	// runStart/runEnd data is not used by the test runner, so do not send it to save bandwidth
	runEnd() {
		return this._sendEvent('runEnd', []);
	}

	runStart() {
		return this._sendEvent('runStart', []);
	}

	suiteEnd(_suite: Suite) {
		if (this.writeHtml) {
			this.suiteNode = <HTMLElement> (this.suiteNode.parentNode.parentNode || document.body);
		}
		return this._sendEvent('suiteEnd', arguments);
	}

	suiteStart(suite: Suite) {
		if (this.writeHtml) {
			const oldSuiteNode = this.suiteNode;
			this.suiteNode = document.createElement('ol');

			if (oldSuiteNode === document.body) {
				oldSuiteNode.appendChild(this.suiteNode);
			}
			else {
				const outerSuiteNode = document.createElement('li');
				const headerNode = document.createElement('div');

				headerNode.appendChild(document.createTextNode(suite.name));
				outerSuiteNode.appendChild(headerNode);
				outerSuiteNode.appendChild(this.suiteNode);
				oldSuiteNode.appendChild(outerSuiteNode);
			}

			scroll();
		}

		return this._sendEvent('suiteStart', arguments);
	}

	suiteError(suite: Suite, error: Error) {
		if (this.writeHtml) {
			this.suiteNode.appendChild(document.createTextNode('Suite "' + suite.id + '" failed'));
			this.suiteNode.style.color = 'red';

			const errorNode = document.createElement('pre');
			errorNode.appendChild(document.createTextNode(util.getErrorMessage(error)));
			this.suiteNode.appendChild(errorNode);
			scroll();
		}

		return this._sendEvent('suiteError', arguments);
	}

	testStart(test: Test) {
		if (this.writeHtml) {
			this.testNode = document.createElement('li');
			this.testNode.appendChild(document.createTextNode(test.name));
			this.suiteNode.appendChild(this.testNode);
			scroll();
		}

		return this._sendEvent('testStart', arguments);
	}

	testPass(test: Test) {
		if (this.writeHtml) {
			this.testNode.appendChild(document.createTextNode(' passed (' + test.timeElapsed + 'ms)'));
			this.testNode.style.color = 'green';
			scroll();
		}

		return this._sendEvent('testPass', arguments);
	}

	testSkip(test: Test) {
		if (this.writeHtml) {
			const testNode = this.testNode = document.createElement('li');
			testNode.appendChild(document.createTextNode(test.name + ' skipped' +
				(test.skipped ? ' (' + test.skipped + ')' : '')));
			testNode.style.color = 'gray';
			this.suiteNode.appendChild(testNode);
			scroll();
		}

		return this._sendEvent('testSkip', arguments);
	}

	testFail(test: Test) {
		if (this.writeHtml) {
			this.testNode.appendChild(document.createTextNode(' failed (' + test.timeElapsed + 'ms)'));
			this.testNode.style.color = 'red';

			const errorNode = document.createElement('pre');
			errorNode.appendChild(document.createTextNode(<string> (util.getErrorMessage(test.error))));
			this.testNode.appendChild(errorNode);
			scroll();
		}

		return this._sendEvent('testFail', arguments);
	}

	private _sendEvent(name: string, args: IArguments | any[]) {
		const data = [ name ].concat(Array.prototype.slice.call(args, 0));
		const shouldWait = util.getShouldWait(this.waitForRunner, data);
		const promise = sendData.send(this.url, data, this.sessionId);

		if (shouldWait) {
			return promise;
		}
	}
}
