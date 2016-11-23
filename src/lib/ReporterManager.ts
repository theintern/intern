import { Config } from '../interfaces';

// AMD modules
import * as has from 'dojo/has';
import * as lang from 'dojo/lang';
import * as aspect from 'dojo/aspect';
import * as Promise from 'dojo/Promise';

// Node modules
import * as fs from 'dojo/has!host-node?dojo/node!fs';
import * as pathUtil from 'dojo/has!host-node?dojo/node!path';
import * as istanbulDefaults from 'dojo/has!host-node?dojo/node!istanbul/lib/report/common/defaults';
import { Watermarks } from 'istanbul';

export interface ReporterConfig {
	console?: any;
	watermarks?: Watermarks;
	filename?: string;
	output?: NodeJS.WritableStream;
}

export interface Reporter {
	[eventName: string]: Listener;
	destroy?: () => void;
	$others?: Listener;
}

export interface ReporterDescriptor {
	id: string;
	filename?: string;
	directory?: string;
	internConfig?: Config;
}

export interface ReporterConstructor {
	new (options?: any): Reporter;
}

export type Listener = (...args: any[]) => (void|Promise<any>);

/**
 * A class that manages a set of reporters
 *
 * Standard events:
 *     coverage
 *     fatalError
 *     newSuite
 *     newTest
 *     proxyEnd
 *     proxyStart
 *     runEnd
 *     runStart
 *     start
 *     stop
 *     suiteEnd
 *     suiteError
 *     suiteStart
 *     testEnd
 *     testPass
 *     testSkip
 *     testStart
 *     tunnelDownloadProgress
 *     tunnelEnd
 *     tunnelStart
 *     tunnelStatus
 */
export class ReporterManager {
	private _earlyEvents: any[] = [];

	private _reporters: Reporter[] = [];

	/**
	 * Add a reporter to the list of managed reporters.
	 */
	add(Reporter: (ReporterConstructor|Object), config?: ReporterConfig) {
		let reporter: any;

		if (typeof Reporter === 'object') {
			reporter = new LegacyReporter(Reporter);
		}
		else {
			config = Object.create(config);
			config.console = this._getConsole();

			// https://github.com/gotwarlost/istanbul/issues/358
			if ('watermarks' in config) {
				config.watermarks = lang.mixin(istanbulDefaults.watermarks(), config.watermarks);
			}

			if (has('host-node')) {
				/* jshint node:true */
				if (config.filename) {
					if (pathUtil.dirname(config.filename) !== '.') {
						mkdir(pathUtil.dirname(config.filename));
					}

					// Lazily create the writable stream so we do not open an extra fd for reporters that use
					// `filename` directly and never touch `config.output`
					defineLazyProperty(config, 'output', function () {
						return fs.createWriteStream(config.filename);
					});
				}
				else {
					// See theintern/intern#454; all \r must be replaced by \x1b[1G (cursor move to column 1)
					// on Windows due to a libuv bug
					let write: (data: string) => any;
					if (process.platform === 'win32') {
						write = function (data) {
							let args: (any[]|IArguments);
							if (typeof data === 'string' && data.indexOf('\r') !== -1) {
								data = data.replace(/\r/g, '\x1b[1G');
								args = [ data ].concat(Array.prototype.slice.call(arguments, 1));
							}
							else {
								args = arguments;
							}

							return process.stdout.write.apply(process.stdout, args);
						};
					}
					else {
						write = process.stdout.write.bind(process.stdout);
					}

					config.output = lang.delegate(process.stdout, {
						write: write,
						// Allow reporters to call `end` regardless of whether or not they are outputting to file,
						// without an error for stdout (which cannot be closed)
						end: write
					});
				}
			}
			else if (has('host-browser')) {
				defineLazyProperty(config, 'output', function () {
					var element = document.createElement('pre');

					return {
						write: function (chunk: string, encoding: string, callback: Function) {
							element.appendChild(document.createTextNode(chunk));
							callback();
						},
						end: function (chunk: string, encoding: string, callback: Function) {
							element.appendChild(document.createTextNode(chunk));
							document.body.appendChild(element);
							callback();
						}
					};
				});
			}

			reporter = new Reporter(config);
		}

		var reporters = this._reporters;
		reporters.push(reporter);

		return {
			remove: function (this: any) {
				this.remove = noop;
				lang.pullFromArray(reporters, reporter);
				return reporter.destroy && reporter.destroy();
			}
		};
	}

	empty() {
		this._reporters.forEach(function (reporter: Reporter) {
			reporter.destroy && reporter.destroy();
		});
		this._reporters = [];
	}

	/**
	 * Emit an event to all registered reporters that can respond to it.
	 *
	 * @param name event name to emit
	 * @returns {Promise.<void>}
	 */
	emit(name: string, ...args: any[]): Promise<any> {
		if (!this._reporters.length) {
			this._earlyEvents.push(Array.prototype.slice.call(arguments, 0));
			return Promise.resolve();
		}

		const allArgs = arguments;

		return Promise.all(this._reporters.map((reporter) => {
			let listener: Listener = (<any> reporter)[name];
			let sendArgs: (IArguments|any[]) = args;

			if (!listener && reporter.$others) {
				listener = reporter.$others;
				sendArgs = allArgs;
			}

			if (listener) {
				// In the case that a fatal error occurs and there are no reporters around that care,
				// the pre-executor will make a hail mary pass to try to get the information out by sending it to
				// the early error reporter if the error does not have a `reported` property
				if (name === 'fatalError' && args[0]) {
					args[0].reported = true;
				}

				try {
					let result = listener.apply(reporter, sendArgs);
					if (result && result.then && name !== 'reporterError') {
						return result.then(null, (error: Error) => {
							return this.emit('reporterError', reporter, error);
						});
					}
					else {
						return result;
					}
				}
				catch (error) {
					if (name !== 'reporterError') {
						return this.emit('reporterError', reporter, error);
					}
					else {
						return Promise.reject(error);
					}
				}
			}
		})).then(noop, noop);
	}

	on(eventName: string, listener: Listener) {
		let reporter: Reporter = {};
		reporter[eventName] = listener;

		let reporters = this._reporters;
		reporters.push(reporter);

		return {
			remove: function (this: any) {
				this.remove = function () {};
				lang.pullFromArray(reporters, reporter);
				reporters = reporter = null;
			}
		};
	}

	_getConsole() {
		if (typeof console !== 'undefined') {
			return console;
		}

		return <Console> {
			assert: noop,
			count: noop,
			dir: noop,
			error: noop,
			exception: noop,
			info: noop,
			log: noop,
			table: noop,
			time: noop,
			timeEnd: noop,
			trace: noop,
			warn: noop
		};
	}

	run() {
		return this
			.emit('run')
			.then(() => {
				const promise = Promise.all(this._earlyEvents.map((event) => {
					return this.emit.apply(this, event);
				}));
				this._earlyEvents.splice(0, Infinity);
				return promise.then(noop, noop);
			});
	}
}

/**
 * A Reporter that wraps a legacy Intern 2 reporter definition object.
 */
class LegacyReporter {
	constructor(reporterMap: { [key: string]: any }) {
		// add all of the properties on the reporterMap that look like topics or map to a known
		// reporter method (e.g., start)
		for (let topicId in reporterMap) {
			let eventName: string = null;

			if (topicId in TOPIC_TO_EVENT) {
				eventName = TOPIC_TO_EVENT[topicId];
			}
			// programmatically transform legacy topic ID to event name
			else if (topicId.charAt(0) === '/') {
				eventName = topicId.slice(1).replace(/\/(\w)/g, function (_, firstLetter) {
					return firstLetter.toUpperCase();
				});
			}
			else {
				continue;
			}

			aspect.before(this, eventName, (function (callback) {
				return function () {
					return callback.apply(reporterMap, arguments);
				};
			})(reporterMap[topicId]));
		}
	}
}

// topics that don't directly map to reporter events
const TOPIC_TO_EVENT: { [key: string]: string } = {
	'/test/new': 'newTest',
	'/suite/new': 'newSuite',
	'/client/end': 'runEnd',
	'/error': 'fatalError',
	'/runner/end': 'runEnd',
	'/runner/start': 'runStart',
	'/tunnel/stop': 'tunnelEnd',
	start: 'run',
	stop: 'destroy'
};

function defineLazyProperty(object: Object, property: string, getter: () => any) {
	Object.defineProperty(object, property, {
		get: function (this: any) {
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

function isDirectory(pathname: string) {
	try {
		return fs.statSync(pathname).isDirectory();
	}
	catch (error) {
		return false;
	}
}

function mkdir(dirname: string) {
	dirname.split(pathUtil.sep).reduce(function (currentPath, part) {
		currentPath = pathUtil.join(currentPath, part);
		if (!isDirectory(currentPath)) {
			fs.mkdirSync(currentPath);
		}
		return currentPath;
	}, '');
}

function noop() {}
