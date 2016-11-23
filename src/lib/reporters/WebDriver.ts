import * as request from 'dojo/request';
import * as Promise from 'dojo/Promise';
import * as util from '../util';
import { IRequire } from 'dojo/loader';
import { Reporter, ReporterConfig, Config } from '../../interfaces';
import { Suite } from '../Suite';
import { Test } from '../Test';

declare const require: IRequire;

function scroll(): void {
	window.scrollTo(0, document.documentElement.scrollHeight || document.body.scrollHeight);
}

export interface WebDriverReporterConfig extends ReporterConfig {
	writeHtml?: boolean;
	sessionId?: string;
	internConfig?: Config;
	maxPostSize?: number;
	waitForRunner?: boolean;
}

export type VoidOrPromise = Promise<any> | void;

export class WebDriver implements Reporter {
	sequence: number;
	url: string;
	writeHtml: boolean;
	sessionId: string;
	waitForRunner: boolean;
	maxPostSize: number;
	suiteNode: Element;
	private _messageBuffer: string[];
	private _activeRequest: Promise<any>;
	private _pendingRequest: Promise<any>;
	testNode: HTMLElement;

	constructor(config: WebDriverReporterConfig = {}) {
		this.sequence = 0;
		this.url = require.toUrl('intern/');
		this.writeHtml = config.writeHtml !== false;
		this.sessionId = config.internConfig.sessionId;
		this.waitForRunner = config.waitForRunner;
		this.maxPostSize = config.maxPostSize || 50000;

		if (this.writeHtml) {
			this.suiteNode = document.body;
		}

		this._messageBuffer = [];
	}

	$others(...args: any[]): VoidOrPromise {
		let [ name ] = args;
		if (name !== 'coverage' && name !== 'run') {
			return this._send(args);
		}
	}

	// runStart/runEnd data is not used by the test runner, so do not send it to save bandwidth
	runEnd(): VoidOrPromise {
		return this._sendEvent('runEnd', []);
	}

	runStart(): VoidOrPromise {
		return this._sendEvent('runStart', []);
	}

	suiteEnd(suite: Suite): VoidOrPromise {
		if (this.writeHtml) {
			this.suiteNode = <Element> (this.suiteNode.parentNode.parentNode || document.body);
		}
		return this._sendEvent('suiteEnd', arguments);
	}

	suiteStart(suite: Suite): VoidOrPromise {
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

	testStart(test: Test): VoidOrPromise {
		if (this.writeHtml) {
			this.testNode = document.createElement('li');
			this.testNode.appendChild(document.createTextNode(test.name));
			this.suiteNode.appendChild(this.testNode);
			scroll();
		}

		return this._sendEvent('testStart', arguments);
	}

	testPass(test: Test): VoidOrPromise {
		if (this.writeHtml) {
			this.testNode.appendChild(document.createTextNode(' passed (' + test.timeElapsed + 'ms)'));
			this.testNode.style.color = 'green';
			scroll();
		}

		return this._sendEvent('testPass', arguments);
	}

	testSkip(test: Test): VoidOrPromise {
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

	testFail(test: Test): VoidOrPromise {
		if (this.writeHtml) {
			this.testNode.appendChild(document.createTextNode(' failed (' + test.timeElapsed + 'ms)'));
			this.testNode.style.color = 'red';

			const errorNode = document.createElement('pre');
			errorNode.appendChild(document.createTextNode(<string> (test.error.stack || test.error)));
			this.testNode.appendChild(errorNode);
			scroll();
		}

		return this._sendEvent('testFail', arguments);
	}

	private _sendEvent(name: string, args: IArguments | any[]): VoidOrPromise {
		return this._send([ name ].concat(Array.prototype.slice.call(args, 0)));
	}

	private _send(data: any[]): VoidOrPromise {
		const self = this;

		// Send a message, or schedule it to be sent. Return a promise that resolves when the message has been sent.
		function sendRequest() {
			// Send all buffered messages and empty the buffer. Note that the posted data will always be an array of
			// objects.
			function send() {
				// Some testing services have problems handling large message POSTs, so limit the maximum size of
				// each POST body to maxPostSize bytes. Always send at least one message, even if it's more than
				// maxPostSize bytes.
				function sendNextBlock(): Promise<any> {
					let block = [ messages.shift() ];
					let size = block[0].length;
					while (messages.length > 0 && size + messages[0].length < self.maxPostSize) {
						size += messages[0].length;
						block.push(messages.shift());
					}

					return request.post(self.url, {
						headers: { 'Content-Type': 'application/json' },
						data: JSON.stringify(block)
					}).then(function () {
						if (messages.length > 0) {
							return sendNextBlock();
						}
					});
				}

				const messages = self._messageBuffer;
				self._messageBuffer = [];

				self._activeRequest = new Promise(function (resolve, reject) {
					return sendNextBlock().then(function () {
						self._activeRequest = null;
						resolve();
					}).catch(function (error) {
						self._activeRequest = null;
						reject(error);
					});
				});

				return self._activeRequest;
			}

			if (self._activeRequest || self._pendingRequest) {
				if (!self._pendingRequest) {
					// Schedule another request after the active one completes
					self._pendingRequest = self._activeRequest.then(function () {
						self._pendingRequest = null;
						return send();
					});
				}
				return self._pendingRequest;
			}
			else {
				return send();
			}
		}

		data = data.map(function (item: any) {
			return item instanceof Error ?
				{ name: item.name, message: item.message, stack: item.stack } : item;
		});

		this._messageBuffer.push(JSON.stringify({
			sequence: this.sequence,
			// Although sessionId is passed as part of the payload, it is passed in the message object as
			// well to allow the conduit to be fully separate and encapsulated from the rest of the code
			sessionId: this.sessionId,
			payload: data
		}));

		// The sequence must not be incremented until after the data is successfully serialised, since an error
		// during serialisation might occur, which would mean the request is never sent, which would mean the
		// dispatcher on the server-side will stall because the sequence numbering will be wrong
		this.sequence++;

		const shouldWait = util.getShouldWait(this.waitForRunner, data);

		if (shouldWait) {
			return sendRequest();
		}
		else {
			sendRequest();
		}
	}
}
