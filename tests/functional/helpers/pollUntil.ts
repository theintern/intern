import registerSuite = require('intern!object');
import * as assert from 'intern/chai!assert';
import Command from 'src/Command';
import pollUntil from 'src/helpers/pollUntil';
import { createSessionFromRemote } from '../support/util';
import Test = require('intern/lib/Test');

function toUrl(url: string) {
	return (<any>require).toUrl(url);
}

registerSuite(function(this: Test) {
	let command: Command<any>;

	return {
		name: 'leadfoot/helpers/pollUntil',

		setup(this: Test) {
			const remote = <any>this.remote;
			return createSessionFromRemote(remote).then(session => {
				command = new Command<void>(session);
			});
		},

		'basic test'() {
			return command
				.get(toUrl('../data/elements.html'))
				.findById('makeD')
				.click()
				.then(
					pollUntil('return document.getElementById("d");', [], 1000)
				)
				.then(function(result: any) {
					assert.property(
						result,
						'elementId',
						'Returned value should be an element'
					);
				});
		},

		'without args'() {
			return command
				.get(toUrl('../data/elements.html'))
				.findById('makeD')
				.click()
				.then(pollUntil('return document.getElementById("d");', 1000))
				.then(function(result: any) {
					assert.property(
						result,
						'elementId',
						'Returned value should be an element'
					);
				});
		},

		'early timeout'() {
			return command
				.get(toUrl('../data/elements.html'))
				.findById('makeDSlowly')
				.click()
				.then(
					pollUntil(
						'return document.getElementById("d");',
						[],
						100,
						25
					)
				)
				.then(
					function() {
						throw new Error('Polling should fail after a timeout');
					},
					function(error: Error) {
						assert.strictEqual(error.name, 'ScriptTimeout');
					}
				);
		},

		'iteration check'() {
			return command
				.get(toUrl('../data/default.html'))
				.then(
					pollUntil<number | never>(
						function() {
							const anyWindow = <any>window;
							if (!anyWindow.counter) {
								anyWindow.counter = 0;
							}

							if (++anyWindow.counter === 4) {
								return anyWindow.counter;
							}
						},
						[],
						1000,
						25
					)
				)
				.then(function(counter) {
					this.findById('#foo');
					assert.strictEqual(counter, 4);
				});
		}
	};
});
