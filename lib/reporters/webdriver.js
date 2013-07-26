define([
	'dojo/aspect',
	'dojo/topic',
	'dojo/request/xhr',
	'../args',
	'require'
], function (aspect, topic, xhr, args, require) {
	var sequence = 0,
		url = require.toUrl('intern'),
		writeHtml = true,
		publishHandle;

	function send(data) {
		for (var i = 0; i < data.length; ++i) {
			if (data[i] instanceof Error) {
				data[i] = { message: data[i].message, stack: data[i].stack };
			}
		}

		xhr(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			data: JSON.stringify({
				sequence: sequence,
				// Although sessionId is passed as part of the payload, it is passed in the message object as well
				// to allow the conduit to be fully separate and encapsulated from the rest of the code
				sessionId: args.sessionId,
				payload: data
			})
		});

		// The sequence must not be incremented until after the data is successfully serialised, since an error during
		// serialisation might occur, which would mean the request is never sent, which would mean the dispatcher on
		// the server-side will stall because the sequence numbering will be wrong
		++sequence;
	}

	if (writeHtml) {
		var suiteNode = document.body,
			testNode,
			scroll = function () {
				window.scrollTo(0, document.documentElement.scrollHeight || document.body.scrollHeight);
			};
	}

	return {
		start: function () {
			publishHandle = aspect.before(topic, 'publish', function (topicName) {
				if (/^\/(?:suite|test|error|client\/end)(?:\/|$)/.test(topicName)) {
					send([].slice.call(arguments, 0));
				}
				return arguments;
			});
		},

		stop: function () {
			publishHandle && publishHandle.remove();
		},

		'/suite/end': function (suite) {
			if (suite.name === 'main') {
				typeof console !== 'undefined' && console.log('Tests complete');

				// TODO: Better place to send sessionId?
				topic.publish('/client/end', args.sessionId);
			}

			if (writeHtml) {
				suiteNode = suiteNode.parentNode.parentNode || document.body;
			}
		},

		'/suite/start': writeHtml ? function (suite) {
			var oldSuiteNode = suiteNode;

			suiteNode = document.createElement('ol');

			if (oldSuiteNode === document.body) {
				oldSuiteNode.appendChild(suiteNode);
			}
			else {
				var outerSuiteNode = document.createElement('li'),
					headerNode = document.createElement('div');

				headerNode.appendChild(document.createTextNode(suite.name));
				outerSuiteNode.appendChild(headerNode);
				outerSuiteNode.appendChild(suiteNode);
				oldSuiteNode.appendChild(outerSuiteNode);
			}

			scroll();
		} : null,

		'/test/start': writeHtml ? function (test) {
			testNode = document.createElement('li');
			testNode.appendChild(document.createTextNode(test.name));
			suiteNode.appendChild(testNode);
			scroll();
		} : null,

		'/test/pass': writeHtml ? function (test) {
			testNode.appendChild(document.createTextNode(' passed (' + test.timeElapsed + 'ms)'));
			testNode.style.color = 'green';
			scroll();
		} : null,

		'/test/fail': writeHtml ? function (test) {
			testNode.appendChild(document.createTextNode(' failed (' + test.timeElapsed + 'ms)'));
			testNode.style.color = 'red';

			var errorNode = document.createElement('pre');
			errorNode.appendChild(document.createTextNode(test.error.stack));
			testNode.appendChild(errorNode);
			scroll();
		} : null
	};
});
