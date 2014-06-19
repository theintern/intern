define([
	'intern!object',
	'intern/chai!assert',
	'intern/dojo/node!../../Command',
	'intern/dojo/node!../../compat',
	'./support/util',
	'require'
], function (registerSuite, assert, Command, compat, util, require) {
	registerSuite(function () {
		var command;
		return {
			name: 'leadfoot/compat',

			setup: function () {
				return util.createSessionFromRemote(this.remote).then(function (session) {
					function CompatCommand() {
						Command.apply(this, arguments);
					}
					CompatCommand.prototype = Object.create(Command.prototype);
					CompatCommand.prototype.constructor = CompatCommand;
					compat.applyTo(CompatCommand.prototype);

					command = new CompatCommand(session);
				});
			},

			'#waitForElement': function () {
				return command
					.get(require.toUrl('./data/default.html'))
					.waitForElement('id', 'not-existing', 100).then(function () {
						throw new Error('Non-existing element should cause rejection');
					}, function (error) {
						assert.strictEqual(error.name, 'NoSuchElement');
						return command.get(require.toUrl('./data/elements.html'))
							.findById('makeD')
								.clickElement()
								.end()
							// The test will simply time out if this fails; this is in order to exercise the default
							// code path that sets the timeout to Infinity
							.waitForElement('id', 'd');
					});
			},

			'#waitForVisible': function () {
				return command
					.get(require.toUrl('./data/default.html'))
					.waitForVisible('id', 'not-existing', 100)
					.then(function () {
						throw new Error('Non-existing element should cause rejection');
					}, function (error) {
						assert.strictEqual(error.name, 'NoSuchElement');
						return command.get(require.toUrl('./data/elements.html'))
							.findById('makeD')
								.clickElement()
								.end()
							.waitForVisible('id', 'd');
					});
			},

			'#isVisible': function () {
				return command
					.get(require.toUrl('./data/visibility.html'))
					.findById('normal')
						.then(function (element) {
							return command.isVisible(element).then(function (isVisible) {
								assert.isTrue(isVisible);
							});
						})
						.isVisible()
						.then(function (isVisible) {
							assert.isTrue(isVisible);
						})
						.end()
					.findById('noDisplay')
						.isVisible()
						.then(function (isVisible) {
							assert.isFalse(isVisible);
						})
						.end()
					.isVisible('id', 'noDisplay')
					.then(function (isVisible) {
						assert.isFalse(isVisible);
					});
			}
		};
	});
});
