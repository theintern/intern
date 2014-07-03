define([
	'intern!object',
	'intern/chai!assert',
	'intern/dojo/node!../../../Command',
	'intern/dojo/node!../../../helpers/pollUntil',
	'../support/util',
	'require'
], function (registerSuite, assert, Command, pollUntil, util, require) {
	registerSuite(function () {
		var command;
		return {
			name: 'leadfoot/helpers/pollUntil',

			setup: function () {
				return util.createSessionFromRemote(this.remote).then(function (session) {
					command = new Command(session);
				});
			},

			'basic test': function () {
				return command
					.get(require.toUrl('../data/elements.html'))
					.findById('makeD')
						.click()
						.end()
					.then(pollUntil('return document.getElementById("d");', [], 1000))
					.then(function (result) {
						assert.property(result, 'elementId', 'Returned value should be an element');
					});
			},

			'early timeout': function () {
				return command
					.get(require.toUrl('../data/elements.html'))
					.findById('makeD')
						.click()
						.end()
					.then(pollUntil('return document.getElementById("d");', [], 100, 25))
					.then(function () {
						throw new Error('Polling should fail after a timeout');
					}, function (error) {
						assert.strictEqual(error.name, 'ScriptTimeout');
					});
			},

			'iteration check': function () {
				return command
					.get(require.toUrl('../data/default.html'))
					.then(pollUntil(function (counter) {
						if ((++counter.count) === 4) {
							return counter;
						}
					}, [ { count: 0 } ], 1000, 25))
					.then(function (counter) {
						assert.deepEqual(counter, { count: 4 });
					});
			}
		};
	});
});
