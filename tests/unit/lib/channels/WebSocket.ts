import _WebSocket from 'src/lib/channels/WebSocket';
import { useFakeTimers, SinonFakeTimers } from 'sinon';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

let WebSocket: typeof _WebSocket;

registerSuite('lib/channels/WebSocket', function () {
	class MockWebSocket {
		addEventListener(name: string, callback: (event: any) => void) {
			if (!eventListeners[name]) {
				eventListeners[name] = [];
			}
			eventListeners[name].push(callback);
		}

		send(data: string) {
			sentData.push(data);
		}
	}

	let removeMocks: () => void;
	let eventListeners: { [name: string]: ((event: any) => void)[] };
	let sentData: string[];
	let clock: SinonFakeTimers;

	return {
		before() {
			return mockRequire(require, 'src/lib/channels/WebSocket', {
				'@dojo/shim/global': { default: { WebSocket: MockWebSocket } }
			}).then(handle => {
				removeMocks = handle.remove;
				WebSocket = handle.module.default;
			});
		},

		after() {
			removeMocks();
		},

		beforeEach() {
			eventListeners = {};
			sentData = [];
			clock = useFakeTimers();
		},

		afterEach() {
			clock.restore();
		},

		tests: {
			'required args'() {
				assert.throws(() => {
					new WebSocket({ sessionId: 'foo', url: 'bar' });
				}, /port is required/);
			},

			'#sendMessage': {
				good() {
					const ws = new WebSocket({ sessionId: 'foo', url: 'bar', port: 12345 });
					assert.lengthOf(eventListeners['message'], 1);
					assert.lengthOf(eventListeners['open'], 1);
					// There are 2 error handlers, one for the initial connection and one for later errors
					assert.lengthOf(eventListeners['error'], 2);

					// Send an open event to the socket so sendMessage will proceed
					eventListeners['open'][0]({});

					const sent = ws.sendMessage('remoteStatus', 'foo');

					return Promise.resolve().then(() => {
						assert.lengthOf(sentData, 1);
						const message = JSON.parse(sentData[0]);
						// Send an ack
						eventListeners['message'][0]({ data: JSON.stringify({ id: message.id }) });

						return sent;
					});
				},

				error() {
					const ws = new WebSocket({ sessionId: 'foo', url: 'bar', port: 12345 });
					eventListeners['open'][0]({});

					const sent = ws.sendMessage('remoteStatus', 'foo');

					return Promise.resolve().then(() => {
						assert.lengthOf(sentData, 1);

						// Call the second error handler
						eventListeners['error'][1]({});

						return sent;
					}).then(
						() => { throw new Error('Send should not have succeeded'); },
						error => { assert.match(error.message, /WebSocket error/); }
					).then(() => {
						// A subsequent send should automatically fail
						return ws.sendMessage('remoteStatus', 'foo');
					}).then(
						() => { throw new Error('Send should not have succeeded'); },
						error => { assert.match(error.message, /WebSocket error/); }
					);
				}
			}
		}
	};
});
