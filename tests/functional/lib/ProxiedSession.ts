import ProxiedSession from 'src/lib/ProxiedSession';
import Server from 'leadfoot/Server';
import Promise from '@dojo/shim/Promise';
import { Remote } from 'src/lib/executors/WebDriver';
import Task from '@dojo/core/async/Task';

// Bring in Test and TestFunction from testing src rather than the src being tested
import Test, { TestFunction } from '../../../src/lib/Test';

const { registerSuite } = intern.getInterface('object');
const assert = intern.getAssertions('assert');

registerSuite(function () {
	const serverUrl = 'https://example.invalid/';
	const serverBasePathLength = 1;
	let session: ProxiedSession;
	let oldGet: any;
	let oldPost: any;
	let oldDelete: any;
	let numGetCalls: number;
	let lastUrl: string;
	let mockCoverage = { isMockCoverage: true };

	function sleep(ms: number) {
		return new Promise(resolve => {
			setTimeout(resolve, ms);
		});
	}

	function createServerFromRemote(remote: Remote) {
		if (!remote.session || !remote.session.server) {
			throw new Error('Unsupported remote');
		}

		return new Server(remote.session.server.url, null);
	}

	function createProxiedSessionFromRemote(remote: Remote) {
		if (!remote.session) {
			throw new Error('Unsupported remote');
		}

		const server = createServerFromRemote(remote);
		const session = new ProxiedSession(remote.session.sessionId, server, remote.session.capabilities);
		session.executor = <any>{
			emit: () => Promise.resolve(),
			log: () => Promise.resolve(),
			config: { }
		};
		return Promise.resolve(session);
	}

	function createCoverageTest(method: 'get' | 'quit'): TestFunction {
		return function (this: Test) {
			let coverage: any;

			let oldCoverage = session.coverageEnabled;
			let oldCoverageVariable = session.coverageVariable;

			// Pre-initialize the browser URL; at least Safari 9 will fail to get coverage if the browser location isn't
			// an http/https URL. This is reasonable since the typical case will be to get coverage from a loaded page.
			let task = session.get('http://example.invalid/');

			return task.then(() => {
				session.coverageEnabled = true;
				session.coverageVariable = '__testCoverage';
				session.executor.emit = <any>function (eventName: string, value: any) {
					if (eventName === 'coverage') {
						coverage = value;
					}
					return Task.resolve();
				};

				if (method === 'get') {
					return session[method]('http://other.invalid/');
				}
				else {
					return session[method]();
				}
			}).then(() => {
				assert.isDefined(coverage, 'Coverage event should have been emitted');
				assert.strictEqual(coverage.sessionId, session.sessionId,
					'Correct session ID should be provided when broadcasting coverage data');
				assert.deepEqual(coverage.coverage, mockCoverage,
					'Code coverage data retrieved from session should be broadcasted');
			}).finally(function () {
				session.coverageEnabled = oldCoverage;
				session.coverageVariable = oldCoverageVariable;
			});
		};
	}

	return {
		name: 'ProxiedSession',

		before() {
			return createProxiedSessionFromRemote(this.remote).then(newSession => {
				session = newSession;
				session.serverUrl = serverUrl;
				session.serverBasePathLength = serverBasePathLength;

				oldGet = session.serverGet;
				oldPost = session.serverPost;
				oldDelete = session.server.deleteSession;

				session.serverGet = <any>function () {
					++numGetCalls;
					return Task.resolve(lastUrl);
				};

				session.serverPost = <any>function (path: string, data: any) {
					if (path === 'url') {
						lastUrl = data.url;
					}
					else if (path === 'execute' && data.args && data.args[0] === '__testCoverage') {
						return Task.resolve(JSON.stringify(mockCoverage));
					}

					return Task.resolve();
				};

				session.server.deleteSession = function () {
					return Task.resolve();
				};
			});
		},

		beforeEach() {
			return session.setHeartbeatInterval(0).then(function () {
				numGetCalls = 0;
				lastUrl = undefined;
			});
		},

		after() {
			if (session) {
				session.serverGet = oldGet;
				session.serverPost = oldPost;
				session.server.deleteSession = oldDelete;
			}
		},

		tests: {
			'#get URL'() {
				return session.get('http://example.invalid/').then(function () {
					assert.strictEqual(lastUrl, 'http://example.invalid/', 'Real URLs should be passed as-is');
				});
			},

			'#get local file'() {
				return session.get('test').then(function () {
					assert.strictEqual(lastUrl, serverUrl + 'test',
						'Local URLs should be converted according to defined proxy URL and base path length');
				});
			},

			'#get coverage': createCoverageTest('get'),

			'#quit coverage': createCoverageTest('quit'),

			'#setHeartbeatInterval'() {
				let lastNumGetCalls: number;
				let startTime: number;

				// Set the heardbeat interval, then wait for about 5x that interval -- should see about 5 get calls (a
				// 'heartbeat' is a getCurrentUrl call, which will call our session's mock 'get' method)
				return session.setHeartbeatInterval(50).then(function () {
					startTime = new Date().getTime();
					return sleep(250);
				}).then(function () {
					const elapsed = new Date().getTime() - startTime;
					assert.closeTo(numGetCalls, Math.floor(elapsed / 50), 1,
						'Heartbeats should occur on the given interval');
					return session.setHeartbeatInterval(0);
				}).then(function () {
					lastNumGetCalls = numGetCalls;
					return sleep(100);
				}).then(function () {
					assert.strictEqual(numGetCalls, lastNumGetCalls,
						'No more heartbeats should occur after being disabled');
				});
			}
		}
	};
});
