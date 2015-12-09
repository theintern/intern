import registerSuite = require('intern!object');
import { assert } from 'intern/chai!';
import ProxiedSession from '../../../lib/ProxiedSession';
import ReporterManager from '../../../lib/ReporterManager';
import Server = require('leadfoot/Server');
import Promise = require('dojo/Promise');
import Command = require('leadfoot/Command');
import { AmdRequire } from '../../../lib/util';

declare var require: AmdRequire;

registerSuite(function () {
	const proxyUrl = 'https://example.invalid/';
	const proxyBasePathLength = require.toUrl('./').length;
	let session: ProxiedSession;
	let oldGet: Function;
	let oldPost: Function;
	let oldDelete: typeof Server.prototype.deleteSession;
	let numGetCalls: number;
	let lastUrl: string;
	const mockCoverage = { isMockCoverage: true };

	function sleep(ms: number) {
		return new Promise<void>(function (resolve) {
			setTimeout(function () {
				resolve();
			}, ms);
		});
	}

	function createServerFromRemote(remote: Command<void>) {
		return new Server(remote.session.server.url);
	}

	function createProxiedSessionFromRemote(remote: Command<void>) {
		const server = createServerFromRemote(remote);
		return Promise.resolve<ProxiedSession>(new ProxiedSession(remote.session.sessionId, server, remote.session.capabilities));
	}

	function createCoverageTest(method: string) {
		return function () {
			let coverageArgs: any[];
			const oldCoverage = session.coverageEnabled;
			const oldCoverageVariable = session.coverageVariable;
			session.coverageEnabled = true;
			session.coverageVariable = '__testCoverage';
			session.reporterManager = new ReporterManager();
			session.reporterManager.on('coverage', function (...args: any[]) {
				coverageArgs = args;
			});

			const url = method === 'get' ? 'http://example.invalid/' : undefined;
			return (<any> session)[method](url).then(function () {
				assert.ok(coverageArgs);
				assert.strictEqual(coverageArgs[0], session.sessionId,
					'Correct session ID should be provided when broadcasting coverage data');
				assert.deepEqual(coverageArgs[1], mockCoverage,
					'Code coverage data retrieved from session should be broadcasted');
			}).finally(function () {
				session.coverageEnabled = oldCoverage;
				session.coverageVariable = oldCoverageVariable;
			});
		};
	}

	return {
		name: 'ProxiedSession',

		setup() {
			return createProxiedSessionFromRemote(this.remote).then(function (_session) {
				session = _session;
				session.proxyUrl = proxyUrl;
				session.proxyBasePathLength = proxyBasePathLength;

				oldGet = (<any> session)._get;
				oldPost = (<any> session)._post;
				oldDelete = session.server.deleteSession;

				(<any> session)._get = function () {
					++numGetCalls;
					return Promise.resolve(lastUrl);
				};

				(<any> session)._post = function (path: string, data: any) {
					if (path === 'url') {
						lastUrl = data.url;
					}
					else if (path === 'execute' && data.args && data.args[0] === '__testCoverage') {
						return Promise.resolve(JSON.stringify(mockCoverage));
					}

					return Promise.resolve(null);
				};

				session.server.deleteSession = function () {
					return Promise.resolve(null);
				};
			});
		},

		beforeEach() {
			return session.setHeartbeatInterval(0).then(function () {
				numGetCalls = 0;
				lastUrl = undefined;
			});
		},

		teardown() {
			if (session) {
				(<any> session)._get = oldGet;
				(<any> session)._post = oldPost;
				session.server.deleteSession = oldDelete;
			}
		},

		'#get URL'() {
			return session.get('http://example.invalid/')
				.then(function () {
					assert.strictEqual(lastUrl, 'http://example.invalid/', 'Real URLs should be passed as-is');
				});
		},

		'#get local file'() {
			return session.get(require.toUrl('./test'))
				.then(function () {
					assert.strictEqual(lastUrl, proxyUrl + 'test',
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
	};
});
