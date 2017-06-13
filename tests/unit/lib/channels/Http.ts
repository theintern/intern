import _Http from 'src/lib/channels/Http';
import { spy } from 'sinon';
import Task from '@dojo/core/async/Task';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

let Http: typeof _Http;

registerSuite('lib/channels/Http', function () {
	const request = spy((path: string) => {
		if (requester) {
			return requester(path);
		}
		const data = requestData && requestData[path];
		return Task.resolve(data);
	});

	let requestData: { [name: string]: string };
	let removeMocks: () => void;
	let requester: ((path: string) => Task<void>) | undefined;

	return {
		before() {
			return mockRequire(require, 'src/lib/channels/Http', {
				'@dojo/core/request/providers/xhr': { default: request }
			}).then(handle => {
				removeMocks = handle.remove;
				Http = handle.module.default;
			});
		},

		after() {
			removeMocks();
		},

		beforeEach() {
			requester = undefined;
		},

		tests: {
			'#sendMessage'() {
				const http = new Http({ sessionId: 'foo', url: 'bar' });
				const requests: (() => void)[] = [];

				requester = () => {
					return new Task<void>(resolve => {
						requests.push(resolve);
					});
				};

				http.sendMessage('remoteStatus', 'foo');
				http.sendMessage('remoteStatus', 'bar');
				const send3 = http.sendMessage('remoteStatus', 'baz');

				// Run first request check in a task resolve since first sendData call waits for a Task resolution
				return Task.resolve().then(() => {
					assert.lengthOf(requests, 1);
					requests[0]();
					return send3;
				}).then(() => {
					assert.equal(request.callCount, 1);
					const messageStrings = JSON.parse(request.getCall(0).args[1].body);
					assert.lengthOf(messageStrings, 3);
					const messages = messageStrings.map(JSON.parse);
					assert.propertyVal(messages[0], 'data', 'foo');
					assert.propertyVal(messages[1], 'data', 'bar');
					assert.propertyVal(messages[2], 'data', 'baz');
				});
			}
		}
	};
});
