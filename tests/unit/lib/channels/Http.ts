import { spy, SinonSpy } from 'sinon';
import Task from '@dojo/core/async/Task';

import _Http from 'src/lib/channels/Http';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

let Http: typeof _Http;

registerSuite('lib/channels/Http', function() {
	const request = spy((path: string, data: any) => {
		if (requestHandler) {
			return requestHandler(path, data);
		}
		const result = requestData && requestData[path];
		return Task.resolve(result);
	});

	let requestData: { [name: string]: string };
	let removeMocks: () => void;
	let requestHandler: SinonSpy | undefined;

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
			requestHandler = undefined;
		},

		tests: {
			'#sendMessage'() {
				const http = new Http({ sessionId: 'foo', url: 'bar' });

				requestHandler = spy((_path: string, data: any) => {
					return new Task<any>(resolve => {
						// Auto-respond to a request after a short timeout
						setTimeout(() => {
							const items = JSON.parse(data.body).map(JSON.parse);
							const responses: any[] = [];
							for (const item of items) {
								responses.push({
									id: item.id,
									data: item.data.toUpperCase()
								});
							}
							resolve({ json: () => Task.resolve(responses) });
						}, 100);
					});
				});

				const send1 = http.sendMessage('remoteStatus', 'foo');
				const send2 = http.sendMessage('remoteStatus', 'bar');
				const send3 = http.sendMessage('remoteStatus', 'baz');

				return Promise.all([send1, send2, send3]).then(results => {
					// First send is a request, and the other two will queue up
					// and be be sent together in a second request
					assert.equal(requestHandler!.callCount, 2);

					// Each message should have its own response
					assert.deepEqual(results[0], { id: '1', data: 'FOO' });
					assert.deepEqual(results[1], { id: '2', data: 'BAR' });
					assert.deepEqual(results[2], { id: '3', data: 'BAZ' });
				});
			}
		}
	};
});
