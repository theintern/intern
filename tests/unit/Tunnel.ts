import Tunnel from 'src/Tunnel';
import * as registerSuite from 'intern!object';
import * as assert from 'intern/chai!assert';
import Test = require('intern/lib/Test');
import Task from '@dojo/core/async/Task';

let tunnel: Tunnel;

registerSuite({
	name: 'unit/Tunnel',

	beforeEach: function() {
		tunnel = new Tunnel(<any>{ foo: 'bar' });
	},

	'#clientUrl': function() {
		tunnel.port = '4446';
		tunnel.hostname = 'foo.com';
		tunnel.protocol = 'https';
		tunnel.pathname = 'bar/baz/';
		assert.strictEqual(tunnel.clientUrl, 'https://foo.com:4446/bar/baz/');
	},

	'#extraCapabilities': function() {
		assert.deepEqual(tunnel.extraCapabilities, {});
	},

	'#start': function() {
		const task = Task.resolve();
		tunnel['_startTask'] = task;
		tunnel['_state'] = 'stopping';
		assert.throws(() => {
			tunnel.start();
		});

		tunnel['_state'] = 'running';
		assert.strictEqual(
			tunnel.start(),
			task,
			'Running tunnel should have returned start task'
		);
	},

	'#stop': {
		'stop a stopping tunnel'() {
			(<any>tunnel)._state = 'stopping';
			return tunnel.stop();
		},

		'stop a starting tunnnel'(this: Test) {
			let timeout: NodeJS.Timer;
			const startTask = new Task(
				resolve => {
					timeout = global.setTimeout(resolve, 500);
				},
				() => {
					clearTimeout(timeout);
				}
			);
			tunnel['_state'] = 'starting';
			tunnel['_startTask'] = startTask;
			tunnel['_stop'] = () => Promise.resolve(0);
			tunnel.stop();

			const dfd = this.async();
			startTask.finally(() => {
				dfd.resolve();
			});
		},

		'stop a tunnel that is not running; throws'() {
			(<any>tunnel)['_state'] = 'stopped';
			(<any>tunnel)['_stop'] = () => Promise.resolve(0);
			(<any>tunnel)['_handle'] = { destroy() {} };
			return tunnel.stop();
		}
	},

	'#sendJobState': function(this: Test) {
		const dfd = this.async();
		tunnel.sendJobState('0', { success: true }).catch(function() {
			dfd.resolve();
		});
	}
});
