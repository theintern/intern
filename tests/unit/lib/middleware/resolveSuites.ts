import _resolveSuites from 'src/lib/middleware/resolveSuites';
import { parse } from 'url';

import { MockResponse } from '../../../support/unit/mocks';
import { sandbox as Sandbox } from 'sinon';

const mockRequire = intern.getPlugin<mocking.MockRequire>('mockRequire');

registerSuite('lib/middleware/resolveSuites', () => {
	let removeMocks: () => void;
	let resolveSuites: typeof _resolveSuites;
	let handler: (request: any, response: any, next?: any) => any;

	const sandbox = Sandbox.create();
	const expandFiles = sandbox.spy((pattern: string) => {
		return [`expanded${pattern}`];
	});
	const url = {
		parse: sandbox.spy((url: string, parseQuery: boolean) => {
			return parse(url, parseQuery);
		})
	};

	return {
		before() {
			return mockRequire(require, 'src/lib/middleware/resolveSuites', {
				'src/lib/node/util': { expandFiles },
				url
			}).then(resource => {
				removeMocks = resource.remove;
				resolveSuites = resource.module.default;
			});
		},

		after() {
			removeMocks();
		},

		beforeEach() {
			handler = resolveSuites();
			sandbox.resetHistory();
		},

		tests: {
			resolve() {
				const response = new MockResponse();
				handler({ url: 'foo?suites=bar*.js' }, response);
				assert.deepEqual(expandFiles.args[0], ['bar*.js']);
				assert.deepEqual(<any>response.data, '[["expandedbar*.js"]]');
			}
		}
	};
});
