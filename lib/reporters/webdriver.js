define([
	'dojo-ts/aspect',
	'dojo-ts/topic',
	'dojo-ts/request/xhr',
	'../args',
	'require'
], function (aspect, topic, xhr, args, require) {
	var sequence = 0,
		url = require.toUrl('teststack');

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

	aspect.before(topic, 'publish', function (topicName) {
		if (/^\/(?:suite|test|error|client\/end)(?:\/|$)/.test(topicName)) {
			send([].slice.call(arguments, 0));
		}
	});

	topic.subscribe('/suite/end', function (suite) {
		if (suite.name === 'main') {
			typeof console !== 'undefined' && console.log('Tests complete');

			// TODO: Better place to send sessionId?
			topic.publish('/client/end', args.sessionId);
		}
	});
});