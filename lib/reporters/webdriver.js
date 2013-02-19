define([
	'dojo-ts/aspect',
	'dojo-ts/json',
	'dojo-ts/topic',
	'dojo-ts/request/xhr',
	'../args',
	'require'
], function (aspect, JSON, topic, xhr, args, require) {
	var sequence = -1,
		url = require.toUrl('teststack');

	function send(data) {
		xhr(url, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json'
			},
			data: JSON.stringify({
				sequence: ++sequence,
				// Although sessionId is passed as part of the payload, it is passed in the message object as well
				// to allow the conduit to be fully separate and encapsulated from the rest of the code
				sessionId: args.sessionId,
				payload: data
			})
		});
	}

	aspect.before(topic, 'publish', function (topicName) {
		if (/^\/(?:suite|test|error)(?:\/|$)/.test(topicName)) {
			send([].slice.call(arguments, 0));
		}
	});

	topic.subscribe('/suite/end', function (suite) {
		if (suite.name === 'main') {
			typeof console !== 'undefined' && console.log('Tests complete');

			// TODO: Better place to send sessionId?
			send([ '/client/end', args.sessionId ]);
		}
	});
});