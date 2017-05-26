import _Server from 'src/lib/Server';
import { mockNodeExecutor } from '../../support/unit/mocks';
import { basename, join, normalize } from 'path';
import { mixin } from '@dojo/core/lang';

const { registerSuite } = intern.getInterface('object');
const assert = intern.getAssertions('assert');
const { removeMocks, requireWithMocks } = <any>intern.getPlugin('mocking');

let Server: typeof _Server;

class EventHandler {
	handlers: { [event: string]: Function[] };

	constructor() {
		this.handlers = {};
	}

	on(event: string, handler: Function) {
		if (!this.handlers[event]) {
			this.handlers[event] = [];
		}
		this.handlers[event].push(handler);
	}

	once() {}
	emit() {}
	prependListener() {}
}

type methodType = 'GET' | 'POST' | 'HEAD';

class MockRequest extends EventHandler {
	method: methodType;
	url: string | undefined;

	constructor(method: methodType, url?: string) {
		super();
		this.method = method;
		this.url = url;
	}

	setEncoding(_encoding: string) {
	}
}

class MockResponse extends EventHandler {
	data: string;
	headers?: object;
	statusCode: number;

	constructor(options?: MockResponseOptions) {
		super();
		this.data = '';
		if (options) {
			mixin(this, options);
		}
	}

	end(data: string | undefined, callback: (error?: Error) => {}) {
		if (data) {
			this.data += data;
		}
		if (callback) {
			callback();
		}
	}

	write(data?: string) {
		this.data += data;
		return true;
	}

	writeHead(status: number, head: object) {
		this.statusCode = status;
		this.headers = head;
	}
}

type MockResponseOptions = {
	[P in keyof MockResponse]?: MockResponse[P]
};

class MockSocket extends EventHandler {
	destroyed: boolean;

	constructor() {
		super();
		this.destroyed = false;
	}

	destroy() {
		this.destroyed = true;
	}

	setNoDelay() {
	}

	send() {
	}
}

class MockServer extends EventHandler {
	closed: boolean;

	constructor() {
		super();
		this.closed = false;
	}

	close(callback?: Function) {
		this.closed = true;
		if (callback) {
			callback();
		}
	}
}

type statType = 'file' | 'directory';

class MockStats {
	path: string;
	type: statType | undefined;
	mtime: { getTime: () => number };

	constructor(path: string, type?: statType) {
		this.path = path;
		this.type = type;
		this.mtime = {
			getTime() {
				return 0;
			}
		};
	}

	isFile() {
		return this.type === 'file';
	}

	isDirectory() {
		return this.type === 'directory';
	}
}

type StatCallback = (error: Error | undefined, stats: MockStats) => void;

function assertPropertyLength(obj: { [key: string]: any }, name: string, length: number, message?: string) {
	assert.property(obj, name, message);
	assert.lengthOf(obj[name], length, message);
}

registerSuite('lib/Server', function () {
	// These classes below access closured data, so they're defined in here

	class MockWebSocketServer extends MockServer {
		constructor() {
			super();
			webSocketServers.push(this);
		}
	}

	class MockHttpServer extends MockServer {
		port: number;
		responder: (request: any, response: any) => void;

		constructor(responder: (request: any, response: any) => void) {
			super();
			this.responder = responder;
			httpServers.push(this);
		}

		listen(port: number, callback: () => void) {
			this.port = port;
			setTimeout(callback);
		}
	}

	class MockReadStream extends EventHandler {
		filename: string;

		constructor(filename: string) {
			super();
			this.filename = filename;
		}

		pipe(stream: MockResponse) {
			const data = fileData[this.filename].data;
			if (data != null) {
				stream.write(data);
			}
		}
	}

	let httpServers: MockHttpServer[];
	let webSocketServers: MockWebSocketServer[];
	let fileData: { [name: string]: { type: statType, data: string } };

	type FsCallback = (error: Error | undefined, data: string) => {};

	const mockFs = {
		createReadStream(filename: string) {
			return new MockReadStream(filename);
		},

		stat(path: string, callback: StatCallback) {
			const entry = fileData[path] || {};
			callback(undefined, new MockStats(path, entry.type));
		},

		readFile(path: string, _encoding: string, callback: FsCallback) {
			const entry = fileData[path];
			callback(undefined, entry.data);
		}
	};

	const mockPath = {
		resolve(path: string) {
			// Normalize fake directory names by adding a trailing '/'
			if (!(/\.\w+$/.test(path)) && path[path.length - 1] !== '/') {
				return path + '/';
			}
			return path;
		},

		join(...args: any[]) {
			return join(...args);
		},

		basename(path: string) {
			return basename(path);
		},

		normalize(path: string) {
			return normalize(path);
		}
	};

	const mockHttp = {
		createServer(handler: () => void) {
			return new MockHttpServer(handler);
		}
	};

	const mockWebSocket = {
		Server: MockWebSocketServer
	};

	return {
		before() {
			return requireWithMocks(require, 'src/lib/Server', {
				'fs': mockFs,
				'http': mockHttp,
				'path': mockPath,
				'ws': mockWebSocket
			}).then((_Server: any) => {
				Server = _Server.default;
			});
		},

		after() {
			removeMocks();
		},

		beforeEach() {
			httpServers = [];
			webSocketServers = [];
			fileData = {};
		},

		tests: {
			'#start': {
				init() {
					const server = new Server({
						executor: mockNodeExecutor(),
						port: 12345
					});
					return server.start().then(() => {
						assert.lengthOf(httpServers, 1, 'unexpected number of HTTP servers were created');
						assert.lengthOf(webSocketServers, 1, 'unexpected number of websocket servers were created');

						const wsServer = webSocketServers[0];
						assertPropertyLength(wsServer.handlers, 'error', 1, 'unexpected number of websocket error handlers');
						assertPropertyLength(wsServer.handlers, 'connection', 1, 'unexpected number of websocket connection handlers');

						const httpServer = httpServers[0];
						assertPropertyLength(httpServer.handlers, 'connection', 1, 'unexpected number of http connection handlers');
						assert.strictEqual(httpServer.port, 12345, 'HTTP server not listening on expected port');
					});
				},

				'http connection': {
					'close with live sockets'() {
						const server = new Server({ executor: mockNodeExecutor() });
						return server.start().then(() => {
							const httpServer = httpServers[0];
							const handler = httpServer.handlers['connection'][0];
							const socket = new MockSocket();
							handler(socket);
							assert.isFalse(socket.destroyed, 'socket should not have been destroyed');
							assertPropertyLength(socket.handlers, 'close', 1, 'unexpected number of socket close handlers');

							httpServer.close();
							assert.isTrue(socket.destroyed, 'socket should have been destroyed');
						});
					},

					'close sockets'() {
						const server = new Server({ executor: mockNodeExecutor() });
						return server.start().then(() => {
							const httpServer = httpServers[0];
							const handler = httpServer.handlers.connection[0];
							const socket = new MockSocket();
							handler(socket);

							// Check the socket handler after closing the HTTP server, because calling it before would
							// prevent Server from trying to destroy it.
							assert.doesNotThrow(() => {
								socket.handlers.close[0]();
							}, 'closing a socket handler should not have thrown');

							httpServer.close();
							assert.isFalse(socket.destroyed, 'socket should not have been destroyed');
						});
					}
				},

				'websocket connection': {
					connect() {
						const server = new Server({ executor: mockNodeExecutor() });
						return server.start().then(() => {
							const wsServer = webSocketServers[0];
							const handler = wsServer.handlers.connection[0];
							const socket = new MockSocket();
							handler(socket);

							assertPropertyLength(socket.handlers, 'message', 1, 'unexpected number of socket message handlers');
							assertPropertyLength(socket.handlers, 'error', 1, 'unexpected number of socket error handlers');
						});
					},

					error() {
						const executor = mockNodeExecutor();
						const server = new Server({ executor });
						return server.start().then(() => {
							const wsServer = webSocketServers[0];
							const handler = wsServer.handlers.error[0];
							const error = new Error('foo');
							handler(error);

							assert.lengthOf(executor.events, 1, 'unexpected number of executor events were emitted');
							assert.deepEqual(executor.events[0], { name: 'error', data: error }, 'unexpected event');
						});
					},

					'socket error'() {
						const executor = mockNodeExecutor();
						const server = new Server({ executor });
						return server.start().then(() => {
							const wsServer = webSocketServers[0];
							const handler = wsServer.handlers.connection[0];
							const socket = new MockSocket();
							handler(socket);

							const error = new Error('foo');
							socket.handlers.error[0](error);

							assert.lengthOf(executor.events, 1, 'unexpected number of executor events were emitted');
							assert.deepEqual(executor.events[0], { name: 'error', data: error }, 'unexpected event');
						});
					}
				},

				'http request handling': {
					'missing file'() {
						const server = new Server({ executor: mockNodeExecutor() });
						return server.start().then(() => {
							const responder = httpServers[0].responder;
							const request = new MockRequest('GET', '/foo/thing.js');
							const response = new MockResponse();

							responder(request, response);
							assert.match(response.data, /404 Not Found/, 'expected 404 response for non-existing file');
							assert.strictEqual(response.statusCode, 404, 'expected 404 status for non-existing file');
						});
					},

					'non-instrumented file'() {
						const server = new Server({
							basePath: '/base',
							executor: mockNodeExecutor({
								shouldInstrumentFile() {
									return false;
								}
							})
						});
						return server.start().then(() => {
							const responder = httpServers[0].responder;
							const request = new MockRequest('GET', '/foo/thing.js');
							const response = new MockResponse();

							// A regular file should be read from basePath
							fileData['/base/foo/thing.js'] = { type: 'file', data: 'what a fun time' };

							responder(request, response);
							assert.equal(response.data, 'what a fun time');
							assert.strictEqual(response.statusCode, 200, 'expected success status for good file');
						});
					},

					'instrumented file': {
						successful() {
							const server = new Server({
								basePath: '/base',
								executor: mockNodeExecutor({
									shouldInstrumentFile: () => true,
									instrumentCode: (code: string, _filename: string) => code
								})
							});
							return server.start().then(() => {
								const responder = httpServers[0].responder;
								const request = new MockRequest('GET', '/foo/thing.js');
								const response = new MockResponse();

								// A regular file should be read from basePath
								fileData['/base/foo/thing.js'] = { type: 'file', data: 'what a fun time' };

								responder(request, response);
								assert.equal(response.data, 'what a fun time');
								assert.strictEqual(response.statusCode, 200, 'expected success status for good file');
							});
						},

						'error sending'() {
							const executor = mockNodeExecutor({
								shouldInstrumentFile: () => true,
								instrumentCode: (code: string, _filename: string) => code
							});
							const server = new Server({ basePath: '/base', executor });
							return server.start().then(() => {
								const responder = httpServers[0].responder;
								const request = new MockRequest('GET', '/foo/thing.js');
								const error = new Error('failed');
								const response = new MockResponse({
									end(_data: string | undefined, callback: (error?: Error) => void) {
										callback(error);
									}
								});

								// An intern resource should be read from internPath
								fileData['/base/foo/thing.js'] = { type: 'file', data: 'what a fun time' };

								responder(request, response);

								assert.lengthOf(executor.events, 1, 'unexpected number of executor events were emitted');
								assert.deepEqual(executor.events[0], { name: 'error', data: error }, 'unexpected event');
							});
						}
					},

					'intern resource'() {
						const server = new Server({ executor: mockNodeExecutor({ config: <any>{ internPath: '/modules/intern/' } }) });
						return server.start().then(() => {
							const responder = httpServers[0].responder;
							const request = new MockRequest('GET', '/__intern/bar/thing.js');
							const response = new MockResponse();

							// An intern resource should be read from internPath
							fileData['/modules/intern/bar/thing.js'] = { type: 'file', data: 'what a fun time' };

							responder(request, response);
							assert.equal(response.data, 'what a fun time');
							assert.strictEqual(response.statusCode, 200, 'expected success status for good file');
						});
					},

					'index URL'() {
						const server = new Server({
							basePath: '/base',
							executor: mockNodeExecutor({
								shouldInstrumentFile() {
									return false;
								}
							})
						});
						return server.start().then(() => {
							const responder = httpServers[0].responder;
							const request = new MockRequest('GET', '/foo');
							const response = new MockResponse();

							// A directory request should look for an index.html file in the directory
							fileData['/base/foo/index.html'] = { type: 'file', data: 'what a fun time' };

							responder(request, response);
							assert.equal(response.data, 'what a fun time');
							assert.strictEqual(response.statusCode, 200, 'expected success status for good file');
						});
					},

					'server closes while responding'() {
						const server = new Server({ executor: mockNodeExecutor() });
						return server.start().then(() => {
							const responder = httpServers[0].responder;
							const request = new MockRequest('GET', '/foo');
							const response = new MockResponse();
							server['_httpServer'] = null;

							responder(request, response);
							assert.equal(response.data, '');
							assert.isUndefined(response.statusCode, 'expected no status for when server was stopped');
						});
					},

					'HEAD request'() {
						const server = new Server({
							basePath: '/base',
							executor: mockNodeExecutor({
								shouldInstrumentFile() {
									return false;
								}
							})
						});
						return server.start().then(() => {
							const responder = httpServers[0].responder;
							const request = new MockRequest('HEAD', '/foo/thing.js');
							const response = new MockResponse();

							// A regular file should be read from basePath
							fileData['/base/foo/thing.js'] = { type: 'file', data: 'what a fun time' };

							responder(request, response);
							assert.equal(response.data, '', 'expected HEAD response to be empty');
							assert.strictEqual(response.statusCode, 200, 'expected success status for good file');
						});
					},

					'POST single message'() {
						const dfd = this.async();
						const server = new Server({ executor: mockNodeExecutor() });
						server.start().then(dfd.rejectOnError(() => {
							const responder = httpServers[0].responder;
							const request = new MockRequest('POST');
							const response = new MockResponse();

							responder(request, response);

							// Request data is a stringified array of stringified messages (or a single stringified
							// stringified message)
							request.handlers.data[0](JSON.stringify(JSON.stringify({
								sessionId: 'foo',
								id: 1,
								name: 'foo'
							})));
							request.handlers.end[0]();

							// Run checks in a timeout since messages are handled in a Promise callback
							setTimeout(dfd.callback(() => {
								assert.equal(response.data, '', 'expected POST response to be empty');
								assert.strictEqual(response.statusCode, 204, 'expected success status for good message');
							}));
						}));
					},

					'POST array of messages'() {
						const dfd = this.async();
						const server = new Server({ executor: mockNodeExecutor() });
						server.start().then(dfd.rejectOnError(() => {
							const responder = httpServers[0].responder;
							const request = new MockRequest('POST');
							const response = new MockResponse();

							responder(request, response);

							// Request data is a stringified array of stringified messages
							request.handlers.data[0](JSON.stringify([
								JSON.stringify({
									sessionId: 'foo',
									id: 1,
									name: 'foo'
								})
							]));
							request.handlers.end[0]();

							// Run checks in a timeout since messages are handled in a Promise callback
							setTimeout(dfd.callback(() => {
								assert.equal(response.data, '', 'expected POST response to be empty');
								assert.strictEqual(response.statusCode, 204, 'expected success status for good messages');
							}));
						}));
					},

					'POST bad message'() {
						const dfd = this.async();
						const server = new Server({ executor: mockNodeExecutor() });
						server.start().then(dfd.rejectOnError(() => {
							const responder = httpServers[0].responder;
							const request = new MockRequest('POST');
							const response = new MockResponse();

							responder(request, response);

							request.handlers.data[0]('[[[');
							request.handlers.end[0]();

							// Run checks in a timeout since messages are handled in a Promise callback
							setTimeout(dfd.callback(() => {
								assert.equal(response.data, '', 'expected POST response to be empty');
								assert.strictEqual(response.statusCode, 500, 'expected error status for bad message');
							}));
						}));
					},

					'POST message handler rejection'() {
						const dfd = this.async();
						const server = new Server({ executor: mockNodeExecutor() });
						server.start().then(dfd.rejectOnError(() => {
							const listener = (_name: string, _data: any) => {
								return Promise.reject(new Error('bad message'));
							};
							server.subscribe('foo', listener);

							const responder = httpServers[0].responder;
							const request = new MockRequest('POST');
							const response = new MockResponse();

							responder(request, response);

							// Request data is a stringified array of stringified messages
							request.handlers.data[0](JSON.stringify([
								JSON.stringify({
									sessionId: 'foo',
									id: 1,
									name: 'foo'
								})
							]));
							request.handlers.end[0]();

							// Run checks in a timeout since messages are handled in a Promise callback
							setTimeout(dfd.callback(() => {
								assert.equal(response.data, '', 'expected POST response to be empty');
								assert.strictEqual(response.statusCode, 500, 'expected error status for bad message');
							}));
						}));
					},

					'bad method'() {
						const server = new Server({ executor: mockNodeExecutor() });
						return server.start().then(() => {
							const responder = httpServers[0].responder;
							const request = new MockRequest(<any>'DELETE');
							const response = new MockResponse();

							responder(request, response);

							assert.equal(response.data, '', 'expected DELETE response to be empty');
							assert.strictEqual(response.statusCode, 501, 'expected error status for bad message');
						});
					}
				}
			},

			'#stop': {
				running() {
					const server = new Server({ executor: mockNodeExecutor() });
					return server.start().then(() => {
						return server.stop().then(() => {
							assert.isTrue(webSocketServers[0].closed, 'websocket server should have been closed');
							assert.isTrue(httpServers[0].closed, 'http server should have been closed');

						});
					});
				},

				'already stopped'() {
					const server = new Server({ executor: mockNodeExecutor() });
					// Check that stop doesn't reject
					return server.stop();
				}
			},

			'#subscribe': {
				'before start'() {
					const server = new Server({ executor: mockNodeExecutor() });
					// Server doesn't initialize its sessions object until it's started, so subscribing before start
					// will fail
					assert.throws(() => {
						server.subscribe('foo', () => {});
					}, /Cannot read property/);
				},

				'publish message'() {
					const server = new Server({ executor: mockNodeExecutor() });
					return server.start().then(() => {
						const messages: { name: string, data: any }[] = [];
						const listener = (name: string, data: any) => {
							messages.push({ name, data });
						};
						const handle = server.subscribe('foo', listener);
						assert.isDefined(handle, 'subscribe should return a handle');

						const wsServer = webSocketServers[0];
						const handler = wsServer.handlers.connection[0];
						const socket = new MockSocket();
						handler(socket);

						socket.handlers.message[0](JSON.stringify({
							sessionId: 'foo',
							id: 1,
							name: 'foo'
						}));

						assert.lengthOf(messages, 1, 'expected 1 message to have been published');

						handle.destroy();

						// Calling destroy multiple times should be fine
						handle.destroy();
					});
				}
			}
		}
	};
});
