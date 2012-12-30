define([
	'dojo-ts/aspect',
	'dojo-ts/topic',
	'dojo-ts/request/xhr',
	'../args',
	'require'
], function (aspect, topic, xhr, args, require) {
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
			send([ '/coverage', window.__teststackCoverage ]);
			send([ '/client/end' ]);
		}
	});
});