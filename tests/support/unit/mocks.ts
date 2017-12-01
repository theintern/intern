/**
 * Mocks are completely artificial entities that have the types of actual
 * classes and interfaces (as far as TypeScript is concerned).
 */
import { sandbox as Sandbox, spy, SinonSpy } from 'sinon';
import { Handle } from '@dojo/core/interfaces';
import { duplicate, mixin, assign } from '@dojo/core/lang';
import Task from '@dojo/core/async/Task';
import Command from '@theintern/leadfoot/Command';

import { Executor, Events } from 'src/lib/executors/Executor';
import Node, { Remote } from 'src/lib/executors/Node';
import Browser from 'src/lib/executors/Browser';
import Server, { ServerListener } from 'src/lib/Server';
import { Message } from 'src/lib/channels/Base';
import ProxiedSession from 'src/lib/ProxiedSession';

/**
 * Create a mock entity
 */
export function createMock<T>(properties?: { [P in keyof T]?: T[P] }) {
	const obj = <T>{};
	if (properties) {
		mixin(obj, properties);
	}
	return obj;
}

/**
 * Create a mock Charm
 */
export function createMockCharm() {
	const sandbox = Sandbox.create();
	const mockCharm = {
		write: sandbox.spy(() => {}),
		erase: sandbox.spy(() => mockCharm),
		position: sandbox.spy(() => mockCharm),
		foreground: sandbox.spy(() => mockCharm),
		display: sandbox.spy(() => mockCharm),
		pipe: sandbox.spy(() => {}),
		_reset() {
			sandbox.resetHistory();
		}
	};
	return mockCharm;
}

/**
 * A mock Executor with an events property that stores emitted events
 */
export interface MockExecutor extends Executor {
	events: { name: string; data: any }[];

	// True if the executor's run method was called
	_ran: boolean;
}

/**
 * Create a MockExecutor with the given property overrides
 */
export function createMockExecutor(
	properties?: { [P in keyof Executor]?: Executor[P] } & { testConfig?: any }
) {
	const _properties: any = duplicate(properties || {});
	if (_properties.testConfig) {
		_properties.config = _properties.testConfig;
		delete _properties.testConfig;
	}
	return createMock<MockExecutor>(
		mixin(
			{
				_ran: false,

				events: <{ name: string; data: any }[]>[],

				config: {},

				configure(options: any) {
					if (options) {
						Object.keys(options).forEach(key => {
							(<any>this).config[key] = options[key];
						});
					}
				},

				emit(eventName: keyof Events, data?: any) {
					// Ignore log events
					if (eventName !== 'log') {
						this.events.push({ name: eventName, data });
					}
					return Task.resolve();
				},

				formatError(error: Error) {
					return error.toString();
				},

				log(...args: any[]) {
					return this.emit('log', JSON.stringify(args));
				},

				on(_eventName: keyof Events) {},

				run() {
					this._ran = true;
				}
			},
			_properties || {}
		)
	);
}

/**
 * A mock Node executor with an events property that stores emitted events
 */
export interface MockBrowser extends Browser {
	events: { name: string; data: any }[];
}

/**
 * Create a MockNode with the given property overrides
 */
export function createMockBrowserExecutor(
	properties?: { [P in keyof Browser]?: Browser[P] }
) {
	const executor = createMockExecutor(
		mixin(
			{
				config: <any>{
					basePath: '/path/to/base/path/',
					internPath: '/modules/intern/'
				}
			},
			properties || {}
		)
	);
	return <MockBrowser>(<any>executor);
}

/**
 * A mock Node executor with an events property that stores emitted events
 */
export interface MockNode extends Node {
	events: { name: string; data: any }[];

	// Make some properties writable
	instrumentedMapStore: any;
	sourceMapStore: any;

	// True if the executor's run method was called
	_ran: boolean;
}

/**
 * Create a MockNode with the given property overrides
 */
export function createMockNodeExecutor(
	properties?: { [P in keyof Node]?: Node[P] }
) {
	const executor = createMockExecutor(
		mixin(
			{
				config: <any>{
					basePath: '/path/to/base/path/',
					internPath: '/modules/intern/'
				},

				server: <Server>{},

				instrumentCode(_code: string, _filename: string) {
					return _code;
				},

				shouldInstrumentFile(_filename: string) {
					return false;
				}
			},
			properties || {}
		)
	);
	return <MockNode>executor;
}

/**
 * A mock CoverageMap
 */
export interface MockCoverageMap {
	_files: string[];
	data: { [key: string]: any };
	files: SinonSpy;
	merge: SinonSpy;
}

/**
 * Create a mock coverage map
 */
export function createMockCoverageMap() {
	const mockCoverageMap: MockCoverageMap = {
		_files: [],
		data: <{ [key: string]: any }>{},
		files: spy(() => mockCoverageMap._files),
		merge: spy((data: any) => {
			Object.keys(data).forEach(key => {
				mockCoverageMap.data[key] = data[key];
			});
		})
	};
	return mockCoverageMap;
}

/**
 * A mock Console object
 */
export interface MockConsole {
	[key: string]: SinonSpy;
}

/**
 * Create a mock Console object
 */
export function createMockConsole(hasGrouping = false) {
	const console: MockConsole = {
		error: spy(() => {}),
		info: spy(() => {}),
		log: spy(() => {}),
		warn: spy(() => {})
	};
	if (hasGrouping) {
		console.group = spy(() => {});
		console.groupEnd = spy(() => {});
	}
	return console;
}

/**
 * Create a mock Server with defaults for required properties and the given
 * property overrides
 */
export function createMockServer(
	properties?: { [P in keyof Server]?: Server[P] }
) {
	return createMock<Server>(
		mixin(
			{
				start() {
					return Promise.resolve();
				},

				stop() {
					return Promise.resolve();
				},

				subscribe(
					_sessionId: string,
					_listener: ServerListener
				): Handle {
					return {
						destroy() {}
					};
				}
			},
			properties || {}
		)
	);
}

/**
 * Create a mock ProxiedSession
 */
export function createMockSession(
	properties?: { [P in keyof ProxiedSession]?: ProxiedSession[P] }
) {
	return createMock<ProxiedSession>(properties);
}

export class MockRemote extends Task<MockRemote> {
	execute(_script: string | Function) {
		return this.then();
	}

	get(_url: string) {
		return this.then();
	}

	setHeartbeatInterval(_delay: number) {
		return this.then();
	}
}

/**
 * Create a mock Remote
 */
export function createMockRemote(
	properties?: {
		[P in keyof (Remote | Command<ProxiedSession>)]?: (
			| Remote
			| Command<ProxiedSession>)[P]
	}
) {
	const remote = MockRemote.resolve();
	mixin(remote, <any>properties);
	return <Remote>(<any>remote);
}

/**
 * Create a mock Remote with a mock Session using a given ID
 */
export function createMockRemoteAndSession(sessionId: string) {
	return createMockRemote({ session: createMockSession({ sessionId }) });
}

export class EventHandler {
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

export type MethodType = 'GET' | 'POST' | 'HEAD';

export interface MockInternObject {
	readonly stopped: boolean;
	readonly basePath: string;
	readonly executor: MockExecutor;
	handleMessage(message: Message): Promise<any>;
}

export class MockRequest extends EventHandler {
	method: MethodType;
	url: string | undefined;
	headers: { [key: string]: string } = Object.create(null);
	body: string | string[];

	intern: MockInternObject;

	constructor(method: MethodType, url?: string) {
		super();
		this.method = method;
		this.url = url;
	}

	setEncoding(_encoding: string) {}
}

export type MockResponseOptions = {
	[P in keyof MockResponse]?: MockResponse[P]
};

export class MockResponse extends EventHandler {
	data: string;
	headers: { [key: string]: string } = Object.create(null);
	statusCode: number;

	intern: MockInternObject;

	constructor(options?: MockResponseOptions) {
		super();
		this.data = '';
		if (options) {
			mixin(this, options);
		}
	}

	end(data: string | undefined, callback?: (error?: Error) => {}) {
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

	writeHead(status: number, head: { [key: string]: string }) {
		this.statusCode = status;
		assign(this.headers, head);
	}

	getHeader(name: string) {
		return this.headers[name];
	}

	setHeader(name: string, value: string) {
		this.headers[name] = String(value);
	}
}

export function createMockServerContext(server: any, handleMessage?: any) {
	return {
		get stopped() {
			return server.stopped;
		},
		get basePath() {
			return server.basePath;
		},
		get executor() {
			return server.executor;
		},
		handleMessage
	};
}
