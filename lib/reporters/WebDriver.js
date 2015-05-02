define([
	'dojo/aspect',
	'dojo/topic',
	'dojo/request',
	'require'
], function (aspect, topic, request, require) {
	function scroll() {
		window.scrollTo(0, document.documentElement.scrollHeight || document.body.scrollHeight);
	}

	function WebDriver(config) {
		config = config || {};

		this.console = config.console;
		this.sequence = 0;
		this.url = require.toUrl('intern/');
		this.publishHandle;
		this.writeHtml = config.writeHtml || true;
		this.sessionId = config.internConfig.sessionId;

		if (this.writeHtml) {
			this.suiteNode = document.body;
		}
	}

	WebDriver.prototype = {
		catchall: function (name) {
			// never send coverage events; coverage is handled explicitly by Proxy
			if (/^(?:suite|test|clientEnd)/.test(name)) {
				this._send(Array.prototype.slice.call(arguments, 0));
			}
		},

		fatalError: function (error) {
			this._sendEvent('fatalError', [ error, this.sessionId ]);
		},

		suiteEnd: function (suite) {
			this._sendEvent('suiteEnd', arguments);

			if (!suite.parent) {
				this.console.log('Tests complete');

				// TODO: Better place to send sessionId?
				this._sendEvent('clientEnd', [ this.sessionId ]);
			}

			if (this.writeHtml) {
				this.suiteNode = this.suiteNode.parentNode.parentNode || document.body;
			}
		},

		suiteStart: function (suite) {
			this._sendEvent('suiteStart', arguments);

			if (this.writeHtml) {
				var oldSuiteNode = this.suiteNode;
				this.suiteNode = document.createElement('ol');

				if (oldSuiteNode === document.body) {
					oldSuiteNode.appendChild(this.suiteNode);
				}
				else {
					var outerSuiteNode = document.createElement('li');
					var headerNode = document.createElement('div');

					headerNode.appendChild(document.createTextNode(suite.name));
					outerSuiteNode.appendChild(headerNode);
					outerSuiteNode.appendChild(this.suiteNode);
					oldSuiteNode.appendChild(outerSuiteNode);
				}

				scroll();
			}
		},

		testStart: function (test) {
			this._sendEvent('testStart', arguments);

			if (this.writeHtml) {
				this.testNode = document.createElement('li');
				this.testNode.appendChild(document.createTextNode(test.name));
				this.suiteNode.appendChild(this.testNode);
				scroll();
			}
		},

		testPass: function (test) {
			this._sendEvent('testPass', arguments);

			if (this.writeHtml) {
				this.testNode.appendChild(document.createTextNode(' passed (' + test.timeElapsed + 'ms)'));
				this.testNode.style.color = 'green';
				scroll();
			}
		},

		testSkip: function (test) {
			this._sendEvent('testSkip', arguments);

			if (this.writeHtml) {
				var testNode = this.testNode = document.createElement('li');
				testNode.appendChild(document.createTextNode(test.name + ' skipped' +
					(test.skipped ? ' (' + test.skipped + ')' : '')));
				testNode.style.color = 'gray';
				this.suiteNode.appendChild(testNode);
				scroll();
			}
		},

		testFail: function (test) {
			this._sendEvent('testFail', arguments);

			if (this.writeHtml) {
				this.testNode.appendChild(document.createTextNode(' failed (' + test.timeElapsed + 'ms)'));
				this.testNode.style.color = 'red';

				var errorNode = document.createElement('pre');
				errorNode.appendChild(document.createTextNode(test.error.stack || test.error));
				this.testNode.appendChild(errorNode);
				scroll();
			}
		},

		_sendEvent: function (name, args) {
			this._send([ name ].concat(Array.prototype.slice.call(args, 0)));
		},

		_send: function (data) {
			data = data.map(function (item) {
				return item instanceof Error ?
					{ name: item.name, message: item.message, stack: item.stack } : item;
			});

			request.post(this.url, {
				headers: {
					'Content-Type': 'application/json'
				},
				data: JSON.stringify({
					sequence: this.sequence,
					// Although sessionId is passed as part of the payload, it is passed in the message object as well
					// to allow the conduit to be fully separate and encapsulated from the rest of the code
					sessionId: this.sessionId,
					payload: data
				})
			});

			// The sequence must not be incremented until after the data is successfully serialised, since an error
			// during serialisation might occur, which would mean the request is never sent, which would mean the
			// dispatcher on the server-side will stall because the sequence numbering will be wrong
			++this.sequence;
		}
	};

	return WebDriver;
});
