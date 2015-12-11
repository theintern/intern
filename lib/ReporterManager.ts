import has = require('dojo/has');
import { delegate as makeDelegate, mixin, pullFromArray } from 'dojo/lang';
import Promise = require('dojo/Promise');
import Executor from './executors/Executor';
import Proxy from './Proxy';
import Suite from './Suite';
import Test from './Test';
import Tunnel = require('digdug/Tunnel');
import { InternConfig } from './executors/PreExecutor';
import { CoverageMap } from 'istanbul/lib/instrumenter';

import _fsType = require('fs');
import _istanbulDefaultsType = require('istanbul/lib/report/common/defaults');

if (has('host-node')) {
	/* tslint:disable:no-var-keyword */
	var fs: typeof _fsType = require('fs');
	var istanbulDefaults: typeof _istanbulDefaultsType = require('istanbul/lib/report/common/defaults');
	/* tslint:enable:no-var-keyword */
}

function defineLazyProperty(object: {}, property: string, getter: () => any) {
	Object.defineProperty(object, property, {
		get() {
			const value = getter.apply(this, arguments);
			Object.defineProperty(object, property, {
				value: value,
				configurable: true,
				enumerable: true
			});
			return value;
		},
		configurable: true,
		enumerable: true
	});
}

function noop() {}

type MaybePromise = any | Promise.Thenable<any>;

export interface OutputStream {
	write(buffer: Buffer | string): boolean;
	end(buffer?: Buffer | string): void;
}

export interface ReporterKwArgs {
	console?: Console;
	filename?: string;
	internConfig?: InternConfig;
	output?: OutputStream;
	watermarks?: _istanbulDefaultsType.Watermarks;
}

export interface ReporterConstructor {
	new (config?: ReporterKwArgs): Reporter;
	prototype: Reporter;
}

export interface Reporter {
	$others?(eventName: string, ...args: any[]): MaybePromise;
	coverage?(sessionId: string, data: CoverageMap): MaybePromise;
	deprecated?(name: string, replacement?: string, extra?: string): MaybePromise;
	destroy?(): MaybePromise;
	fatalError?(error: Error): MaybePromise;
	newSuite?(suite: Suite): MaybePromise;
	newTest?(test: Test): MaybePromise;
	proxyEnd?(proxy: Proxy): MaybePromise;
	proxyStart?(proxy: Proxy): MaybePromise;
	reporterError?(reporter: Reporter, error: Error): MaybePromise;
	run?(): MaybePromise;
	runEnd?(executor: Executor): MaybePromise;
	runStart?(executor: Executor): MaybePromise;
	suiteEnd?(suite: Suite): MaybePromise;
	suiteError?(suite: Suite, error: Error): MaybePromise;
	suiteStart?(suite: Suite): MaybePromise;
	testEnd?(test: Test): MaybePromise;
	testPass?(test: Test): MaybePromise;
	testSkip?(test: Test): MaybePromise;
	testStart?(test: Test): MaybePromise;
	tunnelDownloadProgress?(tunnel: Tunnel, progress: Tunnel.Progress): MaybePromise;
	tunnelEnd?(tunnel: Tunnel): MaybePromise;
	tunnelStart?(tunnel: Tunnel): MaybePromise;
	tunnelStatus?(tunnel: Tunnel, status: string): MaybePromise;
}

/**
 * A class that manages a set of reporters
 */
export default class ReporterManager {
	_earlyEvents: IArguments[] = [];
	_reporters: Reporter[] = [];

	/**
	 * Add a reporter to the list of managed reporters.
	 *
	 * @param {string} name event name to emit
	 */
	add(Reporter: ReporterConstructor, config: ReporterKwArgs) {
		let reporter: Reporter;

		if (typeof Reporter === 'object') {
			throw new Error('Legacy reporters are no longer supported in Intern 4. Please convert your custom reporter to modern reporter form. TODO LINK');
		}

		config = Object.create(config);
		config.console = this._getConsole();

		// https://github.com/gotwarlost/istanbul/issues/358
		if ('watermarks' in config) {
			config.watermarks = mixin(istanbulDefaults.watermarks(), config.watermarks);
		}

		if (has('host-node')) {
			/* jshint node:true */
			if (config.filename) {
				// Lazily create the writable stream so we do not open an extra fd for reporters that use
				// `filename` directly and never touch `config.output`
				defineLazyProperty(config, 'output', function (): OutputStream {
					return fs.createWriteStream(config.filename);
				});
			}
			else {
				// See theintern/intern#454; all \r must be replaced by \x1b[1G (cursor move to column 1)
				// on Windows due to a libuv bug
				let write: (data: Buffer | string) => void;
				if (process.platform === 'win32') {
					write = function (data: Buffer | string) {
						let args: IArguments | any[];
						if (typeof data === 'string' && data.indexOf('\r') !== -1) {
							data = (<string> data).replace(/\r/g, '\x1b[1G');
							args = [ data ].concat(Array.prototype.slice.call(arguments, 1));
						}
						else {
							args = arguments;
						}

						process.stdout.write.apply(process.stdout, args);
					};
				}
				else {
					write = process.stdout.write.bind(process.stdout);
				}

				config.output = makeDelegate(process.stdout, {
					write: write,
					// Allow reporters to call `end` regardless of whether or not they are outputting to file,
					// without an error for stdout (which cannot be closed)
					end: write
				});
			}
		}
		else if (has('host-browser')) {
			defineLazyProperty(config, 'output', function (): OutputStream {
				const element = document.createElement('pre');

				return {
					write(chunk: Buffer | string) {
						element.appendChild(document.createTextNode(String(chunk)));
						return true;
					},
					end(chunk?: Buffer | string) {
						element.appendChild(document.createTextNode(String(chunk)));
						document.body.appendChild(element);
					}
				};
			});
		}

		reporter = new Reporter(config);

		const reporters = this._reporters;
		reporters.push(reporter);

		return {
			remove() {
				this.remove = noop;
				pullFromArray(reporters, reporter);
				return reporter.destroy && reporter.destroy();
			}
		};
	}

	empty() {
		const promise = Promise.all(this._reporters.map(function (reporter) {
			return reporter.destroy && reporter.destroy();
		})).then(noop);
		this._reporters = [];
		return promise;
	}

	/**
	 * Emit an event to all registered reporters that can respond to it.
	 *
	 * @param {string} name event name to emit
	 * @returns {Promise.<void>}
	 */
	emit(name: 'coverage', sessionId: string, data: CoverageMap): Promise<void>;
	emit(name: 'deprecated', replacement?: string, extra?: string): Promise<void>;
	emit(name: 'fatalError', error: Error): Promise<void>;
	emit(name: 'newSuite', suite: Suite): Promise<void>;
	emit(name: 'newTest', test: Test): Promise<void>;
	emit(name: 'proxyEnd', proxy: Proxy): Promise<void>;
	emit(name: 'proxyStart', proxy: Proxy): Promise<void>;
	emit(name: 'reporterError', reporter: Reporter, error: Error): Promise<void>;
	emit(name: 'run'): Promise<void>;
	emit(name: 'runEnd', executor: Executor): Promise<void>;
	emit(name: 'runStart', executor: Executor): Promise<void>;
	emit(name: 'suiteEnd', suite: Suite): Promise<void>;
	emit(name: 'suiteError', suite: Suite, error: Error): Promise<void>;
	emit(name: 'suiteStart', suite: Suite): Promise<void>;
	emit(name: 'testEnd', test: Test): Promise<void>;
	emit(name: 'testPass', test: Test): Promise<void>;
	emit(name: 'testSkip', test: Test): Promise<void>;
	emit(name: 'testStart', test: Test): Promise<void>;
	emit(name: 'tunnelDownloadProgress', tunnel: Tunnel, progress?: { loaded: number; total: number; }): Promise<void>;
	emit(name: 'tunnelEnd', tunnel: Tunnel): Promise<void>;
	emit(name: 'tunnelStart', tunnel: Tunnel): Promise<void>;
	emit(name: 'tunnelStatus', tunnel: Tunnel, status: string): Promise<void>;
	emit(name: 'fatalError', error: Error): Promise<void>;
	emit(name: 'reporterError', reporter: Reporter, error: Error): Promise<void>;
	emit(name: string, ...args: any[]): Promise<void>;
	emit(name: string, ...args: any[]): Promise<void> {
		if (!this._reporters.length) {
			this._earlyEvents.push(Array.prototype.slice.call(arguments, 0));
			return Promise.resolve(undefined);
		}

		const self = this;
		const allArgs = arguments;

		return Promise.all(this._reporters.map(function (reporter) {
			let listener = (<any> reporter)[name];
			let sendArgs = args;

			if (!listener && reporter.$others) {
				listener = reporter.$others;
				sendArgs = <any> allArgs;
			}

			if (listener) {
				// In the case that a fatal error occurs and there are no reporters around that care,
				// the pre-executor will make a hail mary pass to try to get the information out by sending it to
				// the early error reporter if the error does not have a `reported` property
				if (name === 'fatalError' && args[0]) {
					args[0].reported = true;
				}

				try {
					const result = listener.apply(reporter, sendArgs);
					if (result && result.then && name !== 'reporterError') {
						return result.then(null, function (error: Error) {
							return self.emit('reporterError', reporter, error);
						});
					}
					else {
						return result;
					}
				}
				catch (error) {
					if (name !== 'reporterError') {
						return self.emit('reporterError', reporter, error);
					}
					else {
						return Promise.reject(error);
					}
				}
			}
		})).then(noop, noop);
	}

	on(name: 'coverage', listener: (sessionId: string, data: CoverageMap) => MaybePromise): void;
	on(name: 'deprecated', listener: (replacement?: string, extra?: string) => MaybePromise): void;
	on(name: 'fatalError', listener: (error: Error) => MaybePromise): void;
	on(name: 'newSuite', listener: (suite: Suite) => MaybePromise): void;
	on(name: 'newTest', listener: (test: Test) => MaybePromise): void;
	on(name: 'proxyEnd', listener: (proxy: Proxy) => MaybePromise): void;
	on(name: 'proxyStart', listener: (proxy: Proxy) => MaybePromise): void;
	on(name: 'reporterError', listener: (reporter: Reporter, error: Error) => MaybePromise): void;
	on(name: 'run', listener: () => MaybePromise): void;
	on(name: 'runEnd', listener: (executor: Executor) => MaybePromise): void;
	on(name: 'runStart', listener: (executor: Executor) => MaybePromise): void;
	on(name: 'suiteEnd', listener: (suite: Suite) => MaybePromise): void;
	on(name: 'suiteError', listener: (suite: Suite, error: Error) => MaybePromise): void;
	on(name: 'suiteStart', listener: (suite: Suite) => MaybePromise): void;
	on(name: 'testEnd', listener: (test: Test) => MaybePromise): void;
	on(name: 'testPass', listener: (test: Test) => MaybePromise): void;
	on(name: 'testSkip', listener: (test: Test) => MaybePromise): void;
	on(name: 'testStart', listener: (test: Test) => MaybePromise): void;
	on(name: 'tunnelDownloadProgress', listener: (tunnel: Tunnel, progress?: { loaded: number; total: number; }) => MaybePromise): void;
	on(name: 'tunnelEnd', listener: (tunnel: Tunnel) => MaybePromise): void;
	on(name: 'tunnelStart', listener: (tunnel: Tunnel) => MaybePromise): void;
	on(name: 'tunnelStatus', listener: (tunnel: Tunnel, status: string) => MaybePromise): void;
	on(name: 'fatalError', listener: (error: Error) => MaybePromise): void;
	on(name: 'reporterError', listener: (reporter: Reporter, error: Error) => MaybePromise): void;
	on(name: string, listener: (...args: any[]) => MaybePromise): void;
	on(name: string, listener: (...args: any[]) => MaybePromise) {
		let reporter = <Reporter> { [name]: listener };

		let reporters = this._reporters;
		reporters.push(reporter);

		return {
			remove() {
				this.remove = function () {};
				pullFromArray(reporters, reporter);
				reporters = reporter = null;
			}
		};
	}

	protected _getConsole(): Console {
		if (typeof console !== 'undefined') {
			return console;
		}

		const fakeConsole: any = {};

		[
			'assert',
			'count',
			'dir',
			'error',
			'exception',
			'info',
			'log',
			'table',
			'time',
			'timeEnd',
			'trace',
			'warn'
		].forEach(function (key) {
			fakeConsole[key] = noop;
		});

		return fakeConsole;
	}

	run() {
		const self = this;

		function emitEarlyEvents() {
			const promise = Promise.all(self._earlyEvents.map(function (event) {
				return self.emit.apply(self, event);
			}));
			self._earlyEvents.splice(0, Infinity);
			return promise.then(noop, noop);
		}

		return this
			.emit('run')
			.then(emitEarlyEvents);
	}
}
