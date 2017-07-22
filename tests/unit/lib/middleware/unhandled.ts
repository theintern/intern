import unhandled from 'src/lib/middleware/unhandled';

import { HttpError } from 'http-errors';
import { MockRequest, MockResponse } from '../../../support/unit/mocks';
import { spy, SinonSpy } from 'sinon';

registerSuite('lib/middleware/unhandled', function () {
	let handler: (request: any, response: any, next: any) => void;
	let request: MockRequest;
	let response: MockResponse;
	let next: SinonSpy;
	let end: SinonSpy;

	return {
		beforeEach() {
			handler = unhandled();
			request = new MockRequest('GET', '/foo/bar.js');
			response = new MockResponse();
			next = spy();
			end = spy(response, 'end');
		},

		tests: {
			'unhandled request'() {
				handler(request, response, next);

				assert.isFalse(end.called);
				assert.isTrue(next.calledOnce);
				assert.instanceOf(next.firstCall.args[0], HttpError);
				assert.strictEqual(next.firstCall.args[0].statusCode, 501);
			}
		}
	};
});
