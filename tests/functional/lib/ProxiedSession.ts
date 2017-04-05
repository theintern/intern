import ProxiedSession from 'src/lib/ProxiedSession';
import Server from 'leadfoot/Server';
import Promise from '@dojo/shim/Promise';
import { Remote } from 'src/lib/executors/WebDriver';
import Task from '@dojo/core/async/Task';

const { registerSuite } = intern.getInterface('object');
const assert = intern.getAssertions('assert');

registerSuite(function () {
	const serverrUrl = 'https://example.invalid/';
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
			config: { }
		};
		return Promise.resolve(session);
	}

	function createCoverageTest(method: 'get' | 'quit') {
		return function () {
			let coverage: any;

			let oldCoverage = session.coverageEnabled;
			let oldCoverageVariable = session.coverageVariable;

			session.coverageEnabled = true;
			session.coverageVariable = '__testCoverage';
			session.executor.emit = <any>function (eventName: string, value: any) {
				if (eventName === 'coverage') {
					coverage = value;
				}
				return Task.resolve();
			};

			let task: Task<any>;

			if (method === 'get') {
				task = session[method]('http://example.invalid/');
			}
			else {
				task = session[method]();
			}
			return task.then(function () {
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
				session.serverUrl = serverrUrl;
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
					assert.strictEqual(lastUrl, serverrUrl + 'test',
						'Local URLs should be converted according to defined proxy URL and base path length');
				});
			},

			'#get coverage': createCoverageTest('get'),

			'#quit coverage': createCoverageTest('quit'),

			'#setHeartbeatInterval'() {
				let lastNumGetCalls: number;
				return session.setHeartbeatInterval(50).then(function () {
					return sleep(250);
				}).then(function () {
					assert.closeTo(numGetCalls, 5, 1, 'Heartbeats should occur on the given interval');
					lastNumGetCalls = numGetCalls;

					return session.setHeartbeatInterval(0);
				}).then(function () {
					return sleep(100);
				}).then(function () {
					assert.strictEqual(numGetCalls, lastNumGetCalls,
						'No more heartbeats should occur after being disabled');
				});
			}
		}
	};
});
