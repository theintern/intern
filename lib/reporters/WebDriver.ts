import request = require('dojo/request');
import { IResponse } from 'dojo/request';
import Promise = require('dojo/Promise');
import { AmdRequire, getShouldWait } from '../util';
import { Reporter, ReporterKwArgs } from '../ReporterManager';
import { InternClientConfig } from '../executors/Client';
import Suite from '../Suite';
import Test from '../Test';

declare const require: AmdRequire;

function scroll() {
	window.scrollTo(0, document.documentElement.scrollHeight || document.body.scrollHeight);
}

export interface KwArgs extends ReporterKwArgs {
	internConfig?: InternClientConfig;
	waitForRunner?: boolean;
	writeHtml?: boolean;
}

export default class WebDriver implements Reporter {
	sequence: number;
	url: string;
	writeHtml: boolean;
	sessionId: string;
	waitForRunner: boolean;
	suiteNode: HTMLElement;
	testNode: HTMLElement;
	private _messageBuffer: string[];
	private _activeRequest: Promise<IResponse>;
	private _pendingRequest: Promise<IResponse>;

	constructor(config: KwArgs = {}) {
		this.sequence = 0;
		this.url = require.toUrl('intern/');
		this.writeHtml = config.writeHtml !== false;
		this.sessionId = config.internConfig.sessionId;
		this.waitForRunner = config.waitForRunner;

		if (this.writeHtml) {
			this.suiteNode = document.body;
		}

		this._messageBuffer = [];
	}

	$others(name: string) {
		// never send coverage events; coverage is handled explicitly by Proxy
		if (name !== 'coverage' && name !== 'run') {
			return this._send(Array.prototype.slice.call(arguments, 0));
		}
	}

	// runStart/runEnd data is not used by the test runner, so do not send it to save bandwidth
	runEnd() {
		return this._sendEvent('runEnd', []);
	}

	runStart() {
		return this._sendEvent('runStart', []);
	}

	suiteEnd() {
		if (this.writeHtml) {
			this.suiteNode = (<HTMLElement> this.suiteNode.parentNode.parentNode) || document.body;
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
			errorNode.appendChild(document.createTextNode(test.error.stack || String(test.error)));
			this.testNode.appendChild(errorNode);
			scroll();
		}

		return this._sendEvent('testFail', arguments);
	}

	_sendEvent(name: string, args: IArguments | any[]) {
		return this._send([ name ].concat(Array.prototype.slice.call(args, 0)));
	}

	_send(data: any[]) {
		const self = this;

		// Send a message, or schedule it to be sent. Return a promise that resolves when the message has been sent.
		function sendRequest() {
			// Send all buffered messages and empty the buffer. Note that the posted data will always be an array of
			// objects.
			function send() {
				self._activeRequest = request.post(self.url, {
					headers: {
						'Content-Type': 'application/json'
					},
					data: JSON.stringify(self._messageBuffer)
				}).then(function (data) {
					self._activeRequest = null;
					return data;
				});

				self._messageBuffer = [];

				return self._activeRequest;
			}

			if (self._activeRequest) {
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

		data = data.map(function (item) {
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

		const shouldWait = getShouldWait(this.waitForRunner, data[0]);

		if (shouldWait) {
			return sendRequest();
		}
		else {
			sendRequest();
		}
	}
}
