import * as util from './util';

// AMD modules
import * as lang from 'dojo/lang';
import * as Promise from 'dojo/Promise';
import * as aspect from 'dojo/aspect';
import { IRequire } from 'dojo/loader';

// Node modules
import * as http from 'dojo/node!http';
import * as path from 'dojo/node!path';
import * as fs from 'dojo/node!fs';
import * as mimetype from 'dojo/node!mimetype';
import * as url from 'dojo/node!url';
import * as net from 'dojo/node!net';

// Assumes we're running under an AMD loader
declare const require: IRequire;

export type ProxyConfig = {
	basePath?: string;
	excludeInstrumentation?: boolean|RegExp;
	instrument?: boolean;
	instrumenterOptions?: any;
	port?: number;
	waitForRunner?: boolean;
}

export class Proxy {
	config: ProxyConfig;

	server: http.Server;

	private _codeCache: { [filename: string]: { mtime: number, data: string } };

	private _sessions: { [id: string]: { lastSequence: number, queue: any, listeners: any[] } };

	constructor(config: ProxyConfig = {}) {
		this.config = config;
	}

	start() {
		return new Promise((resolve) => {
			const server = this.server = http.createServer((request: http.IncomingMessage, response: http.ServerResponse) => {
				return this._handler(request, response);
			});
			this._sessions = {};
			this._codeCache = {};

			const sockets: net.Socket[] = [];

			// If sockets are not manually destroyed then Node.js will keep itself running until they all expire
			aspect.after(server, 'close', function () {
				let socket: net.Socket;
				while ((socket = sockets.pop())) {
					socket.destroy();
				}
			});

			server.on('connection', function (socket) {
				sockets.push(socket);

				// Disabling Nagle improves server performance on low-latency connections, which are more common
				// during testing than high-latency connections
				socket.setNoDelay(true);

				socket.on('close', function () {
					let index = sockets.indexOf(socket);
					index !== -1 && sockets.splice(index, 1);
				});
			});

			server.listen(this.config.port, resolve);
		});
	}

	stop() {
		return new Promise((resolve) => {
			if (this.server) {
				this.server.close(resolve);
			}
			else {
				resolve();
			}

			this.server = this._codeCache = null;
		});
	}

	subscribeToSession(sessionId: string, listener: Function) {
		const listeners = this._getSession(sessionId).listeners;
		listeners.push(listener);
		return {
			remove: function (this: any) {
				this.remove = function () {};
				lang.pullFromArray(listeners, listener);
			}
		};
	}

	private _getSession(sessionId: string) {
		let session = this._sessions[sessionId];
		if (!session) {
			session = this._sessions[sessionId] = { lastSequence: -1, queue: {}, listeners: [] };
		}
		return session;
	}

	/* private */ _handler(request: http.IncomingMessage, response: http.ServerResponse) {
		if (request.method === 'GET') {
			if (/\/__resolveSuites__\?/.test(request.url)) {
				this._resolveSuites(request, response);
			}
			else if (/\.js(?:$|\?)/.test(request.url)) {
				this._handleFile(request, response, this.config.instrument);
			}
			else {
				this._handleFile(request, response);
			}
		}
		else if (request.method === 'HEAD') {
			this._handleFile(request, response, false, true);
		}
		else if (request.method === 'POST') {
			request.setEncoding('utf8');

			let data = '';
			request.on('data', function (chunk) {
				data += chunk;
			});

			request.on('end', () => {
				try {
					const messages: Message[] = JSON.parse(data).map(function (messageString: string) {
						return JSON.parse(messageString);
					});

					const runnerReporterPromise = Promise.all(messages.map((message) => {
						return this._publishInSequence(message);
					}));

					let shouldWait = messages.some((message) => {
						return util.getShouldWait(this.config.waitForRunner, message.payload);
					});

					if (shouldWait) {
						runnerReporterPromise.then(
							function () {
								response.statusCode = 204;
								response.end();
							},
							function () {
								response.statusCode = 500;
								response.end();
							}
						);
					}
					else {
						response.statusCode = 204;
						response.end();
					}
				}
				catch (error) {
					response.statusCode = 500;
					response.end();
				}
			});
		}
		else {
			response.statusCode = 501;
			response.end();
		}
	}

	/* private */ _handleFile(request: http.IncomingMessage, response: http.ServerResponse, instrument?: boolean, omitContent?: boolean) {
		function send(contentType: string, data: string) {
			response.writeHead(200, {
				'Content-Type': contentType,
				'Content-Length': Buffer.byteLength(data)
			});
			response.end(data);
		}

		const file = /^\/+([^?]*)/.exec(request.url)[1];
		let wholePath: string;

		if (/^__intern\//.test(file)) {
			wholePath = path.join(require.toUrl('intern/'), file.replace(/^__intern\//, ''));
			instrument = false;
		}
		else {
			wholePath = path.join(this.config.basePath, file);
		}

		wholePath = util.normalizePath(wholePath);

		if (wholePath.charAt(wholePath.length - 1) === '/') {
			wholePath += 'index.html';
		}

		const config = this.config;

		// if the string passed to `excludeInstrumentation` changes here, it must also change in
		// `lib/executors/Executor.js`
		if (
			config.excludeInstrumentation === true ||
			(config.excludeInstrumentation && config.excludeInstrumentation.test(file))
		) {
			instrument = false;
		}

		const contentType = mimetype.lookup(path.basename(wholePath)) || 'application/octet-stream';
		fs.stat(wholePath, (error, stats) => {
			// The proxy server was stopped before this file was served
			if (!this.server) {
				return;
			}

			if (error) {
				this._send404(response);
				return;
			}

			if (instrument) {
				const mtime = stats.mtime.getTime();
				if (this._codeCache[wholePath] && this._codeCache[wholePath].mtime === mtime) {
					send(contentType, this._codeCache[wholePath].data);
				}
				else {
					fs.readFile(wholePath, 'utf8', (error, data) => {
						// The proxy server was stopped in the middle of the file read
						if (!this.server) {
							return;
						}

						if (error) {
							this._send404(response);
							return;
						}

						// providing `wholePath` to the instrumenter instead of a partial filename is necessary because
						// lcov.info requires full path names as per the lcov spec
						data = util.instrument(
							data,
							wholePath,
							this.config.instrumenterOptions
						);
						this._codeCache[wholePath] = {
							// strictly speaking mtime could reflect a previous version, assume those race conditions are rare
							mtime: mtime,
							data: data
						};
						send(contentType, data);
					});
				}
			}
			else {
				response.writeHead(200, {
					'Content-Type': contentType,
					'Content-Length': stats.size
				});

				if (omitContent) {
					response.end();
				}
				else {
					fs.createReadStream(wholePath).pipe(response);
				}
			}
		});
	}

	private _publishInSequence(message: Message) {
		const session = this._getSession(message.sessionId);

		if (message.sequence <= session.lastSequence) {
			throw new Error('Repeated sequence for session ' + message.sessionId + ': ' + session.lastSequence +
				' last ' + message.sequence + ' cur');
		}

		message.resolver = new Promise.Deferred(function (reason) {
			message.cancelled = true;
			throw reason;
		});

		if (message.sequence > session.lastSequence + 1) {
			session.queue[message.sequence] = message;
			return message.resolver.promise;
		}

		let triggerMessage = message;

		do {
			session.lastSequence = message.sequence;
			delete session.queue[session.lastSequence];

			if (!message.cancelled) {
				message.resolver.resolve(Promise.all(session.listeners.map(function (listener) {
					return listener.apply(null, message.payload);
				})));
			}
		}
		while ((message = session.queue[message.sequence + 1]));

		return triggerMessage.resolver.promise;
	}

	/* private*/ _resolveSuites(request: http.IncomingMessage, response: http.ServerResponse) {
		const query = url.parse(request.url, true).query;
		const suites = JSON.parse(query.suites);
		const resolvedSuites = JSON.stringify(util.resolveModuleIds(suites));
		response.writeHead(200, {
			'Content-Type': 'application/json',
			'Content-Length': resolvedSuites.length
		});
		response.end(resolvedSuites);
	}

	private _send404(response: http.ServerResponse) {
		response.writeHead(404, {
			'Content-Type': 'text/html;charset=utf-8'
		});
		response.end(`<!DOCTYPE html><title>404 Not Found</title><h1>404 Not Found</h1>` +
			`<!-- ${new Array(512).join('.')} -->`);
	}
}

interface Message {
	sessionId: string;
	sequence: number;
	resolver: Promise.Deferred<any>;
	cancelled: boolean;
	payload: string;
}
