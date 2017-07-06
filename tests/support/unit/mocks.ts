/**
 * Mocks are completely artificial entities that have the types of actual classes and interfaces (as far as TypeScript
 * is concerned).
 */
import Executor, { Events } from 'src/lib/executors/Executor';
import Node  from 'src/lib/executors/Node';
import Server, { ServerListener } from 'src/lib/Server';
import { Handle } from '@dojo/interfaces/core';
import { Remote } from 'src/lib/executors/Node';
import Command from '@theintern/leadfoot/Command';
import ProxiedSession from 'src/lib/ProxiedSession';

import { duplicate, mixin } from '@dojo/core/lang';
import Task from '@dojo/core/async/Task';

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
 * A mock Executor with an events property that stores emitted events
 */
export interface MockExecutor extends Executor {
	events: { name: string, data: any }[];
}

/**
 * Create a MockExecutor with the given property overrides
 */
export function mockExecutor(properties?: { [P in keyof Executor]?: Executor[P] } & { testConfig?: any }) {
	const _properties: any = duplicate(properties || {});
	if (_properties.testConfig) {
		_properties.config = _properties.testConfig;
		delete _properties.testConfig;
	}
	return createMock<MockExecutor>(mixin({
		events: <{ name: string, data: any }[]>[],

		config: {},

		emit(eventName: keyof Events, data?: any) {
			// Ignore log events
			if (eventName !== 'log') {
				this.events.push({ name: eventName, data });
			}
			return Task.resolve();
		},

		log(...args: any[]) {
			return this.emit('log', JSON.stringify(args));
		}
	}, _properties || {}));
}

/**
 * A mock Node executor with an events property that stores emitted events
 */
export interface MockNode extends Node {
	events: { name: string, data: any }[];

	// Make some properties writable
	instrumentedMapStore: any;
	sourceMapStore: any;
}

/**
 * Create a MockNode with the given property overrides
 */
export function mockNodeExecutor(properties?: { [P in keyof Node]?: Node[P] }) {
	const executor = mockExecutor(mixin({
		server: <Server>{},

		instrumentCode(_code: string, _filename: string) {
			return _code;
		},

		shouldInstrumentFile(_filename: string) {
			return false;
		}
	}, properties || {}));
	return <MockNode>executor;
}

/**
 * Create a mock Server with defaults for required properties and the given property overrides
 */
export function mockServer(properties?: { [P in keyof Server]?: Server[P] }) {
	return createMock<Server>(mixin({
		start() {
			return Promise.resolve();
		},

		stop() {
			return Promise.resolve();
		},

		subscribe(_sessionId: string, _listener: ServerListener): Handle {
			return {
				destroy() {}
			};
		}
	}, properties || {}));
}

/**
 * Create a mock ProxiedSession
 */
export function mockSession(properties?: { [P in keyof ProxiedSession]?: ProxiedSession[P] }) {
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
export function mockRemote(properties?: { [P in keyof (Remote | Command<ProxiedSession>)]?: (Remote | Command<ProxiedSession>)[P] }) {
	const remote = MockRemote.resolve();
	mixin(remote, <any>properties);
	return <Remote>(<any>remote);
}

/**
 * Create a mock Remote with a mock Session using a given ID
 */
export function mockRemoteAndSession(sessionId: string) {
	return mockRemote({ session: mockSession({ sessionId }) });
}
