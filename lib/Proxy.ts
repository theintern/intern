import { after as aspectAfter } from 'dojo/aspect';
import { pullFromArray } from 'dojo/lang';
import Promise = require('dojo/Promise');
import * as fs from 'fs';
import { createServer as createHttpServer, Server as HttpServer, ServerRequest, ServerResponse } from 'http';
import { Socket as NetSocket } from 'net';
import { basename as getBaseName, join as joinPaths } from 'path';
import { default_type as defaultMimeType, lookup as lookUpMimeType } from 'mime';
import * as util from './util';

type TODO = any;

interface Message {
	cancelled: boolean;
	payload: TODO[];
	resolver: Promise.Deferred<void>;
	sequence: number;
	sessionId: string;
}

interface SessionListener {
	(eventName: string): void | Promise.Thenable<void>;
}

interface Session {
	lastSequence: number;
	queue: TODO;
	listeners: SessionListener[];
}

export interface KwArgs {
	basePath: string;
	coverageVariable: string;
	excludeInstrumentation: boolean | RegExp;
	instrument: boolean;
	port: number;
	waitForRunner: boolean | string | string[];
}

export default class Proxy {
	constructor(config: KwArgs) {
		this.config = config;
	}

	config: KwArgs;
	private codeCache: { [wholePath: string]: string; };
	private sessions: { [sessionId: string]: Session; };
	private server: HttpServer;

	private getSession(sessionId: string) {
		let session = this.sessions[sessionId];
		if (!session) {
			session = this.sessions[sessionId] = { lastSequence: -1, queue: {}, listeners: [] };
		}

		return session;
	}

	protected handler(request: ServerRequest, response: ServerResponse) {
		if (request.method === 'GET') {
			if (/\.js(?:$|\?)/.test(request.url)) {
				this.handleFile(request, response, this.config.instrument);
			}
			else {
				this.handleFile(request, response, false);
			}
		}
		else if (request.method === 'POST') {
			this.handleConduitMessage(request, response);
		}
		else {
			response.statusCode = 501;
			response.end();
		}
	}

	private handleConduitMessage(request: ServerRequest, response: ServerResponse) {
		request.setEncoding('utf8');

		let data = '';
		request.on('data', function (chunk: string) {
			data += chunk;
		});

		request.on('end', () => {
			const messages: Message[] = JSON.parse(data).map(function (messageString: string): Message {
				return JSON.parse(messageString);
			});

			const runnerReporterPromise = Promise.all(messages.map((message) => {
				return this.publishInSequence(message);
			}));

			const shouldWait = messages.some((message) => {
				return util.getShouldWait(this.config.waitForRunner, message.payload[0]);
			});

			if (shouldWait) {
				runnerReporterPromise.then(function () {
					response.statusCode = 204;
					response.end();
				}, function () {
					response.statusCode = 500;
					response.end();
				});
			}
			else {
				response.statusCode = 204;
				response.end();
			}
		});
	}

	private handleFile(request: ServerRequest, response: ServerResponse, instrument: boolean) {
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
			wholePath = joinPaths(require.resolve('intern/'), file.replace(/^__intern\//, ''));
			instrument = false;
		}
		else {
			wholePath = joinPaths(this.config.basePath, file);
		}

		wholePath = util.normalizePath(wholePath);

		if (wholePath.charAt(wholePath.length - 1) === '/') {
			wholePath += 'index.html';
		}

		// if the string passed to `excludeInstrumentation` changes here, it must also change in
		// `lib/executors/Executor.js`
		if (
			this.config.excludeInstrumentation === true ||
			(
				this.config.excludeInstrumentation &&
				(<RegExp> this.config.excludeInstrumentation).test(file)
			)
		) {
			instrument = false;
		}

		const contentType = lookUpMimeType(getBaseName(wholePath)) || defaultMimeType;
		if (instrument) {
			if (this.codeCache[wholePath]) {
				send(contentType, this.codeCache[wholePath]);
			}
			else {
				fs.readFile(wholePath, 'utf8', (error, data) => {
					// The proxy server was stopped in the middle of the file read
					if (!this.server) {
						return;
					}

					if (error) {
						this.send404(response);
						return;
					}

					// providing `wholePath` to the instrumenter instead of a partial filename is necessary because
					// lcov.info requires full path names as per the lcov spec
					data = this.codeCache[wholePath] = util.instrument(
						data,
						wholePath,
						this.config.coverageVariable
					);
					send(contentType, data);
				});
			}
		}
		else {
			fs.stat(wholePath, (error, status) => {
				// The proxy server was stopped in the middle of the file stat
				if (!this.server) {
					return;
				}

				if (error) {
					this.send404(response);
					return;
				}

				response.writeHead(200, {
					'Content-Type': contentType,
					'Content-Length': status.size
				});

				fs.createReadStream(wholePath).pipe(response);
			});
		}
	}

	private publishInSequence(message: Message) {
		const session = this.getSession(message.sessionId);

		if (message.sequence <= session.lastSequence) {
			throw new Error('Repeated sequence for session ' + message.sessionId + ': ' + session.lastSequence +
				' last ' + message.sequence + ' cur');
		}

		message.resolver = new Promise.Deferred<void>(function (reason) {
			message.cancelled = true;
			throw reason;
		});

		if (message.sequence > session.lastSequence + 1) {
			session.queue[message.sequence] = message;
			return message.resolver.promise;
		}

		const triggerMessage = message;

		do {
			session.lastSequence = message.sequence;
			delete session.queue[session.lastSequence];

			if (!message.cancelled) {
				message.resolver.resolve(Promise.all(session.listeners.map(function (listener) {
					return listener.apply(null, message.payload);
				})).then(function () {}));
			}
		}
		while ((message = session.queue[message.sequence + 1]));

		return triggerMessage.resolver.promise;
	}

	private send404(response: ServerResponse) {
		response.writeHead(404, {
			'Content-Type': 'text/html;charset=utf-8'
		});
		response.end('<!DOCTYPE html><title>404 Not Found</title><h1>404 Not Found</h1><!-- ' +
			new Array(512).join('.') + ' -->');
	}

	start() {
		return new Promise<void>(function (resolve: () => void) {
			const server = this.server = createHttpServer(this.handler.bind(this));
			this.sessions = {};
			this.codeCache = {};

			const sockets: NetSocket[] = [];

			// If sockets are not manually destroyed then Node.js will keep itself running until they all expire
			aspectAfter(server, 'close', function () {
				let socket: NetSocket;
				while ((socket = sockets.pop())) {
					socket.destroy();
				}
			});

			server.on('connection', function (socket: NetSocket) {
				sockets.push(socket);

				// Disabling Nagle improves server performance on low-latency connections, which are more common
				// during testing than high-latency connections
				socket.setNoDelay(true);

				socket.on('close', function () {
					const index = sockets.indexOf(socket);
					index !== -1 && sockets.splice(index, 1);
				});
			});

			server.listen(this.config.port, resolve);
		}.bind(this));
	}

	stop() {
		return new Promise<void>((resolve) => {
			if (this.server) {
				this.server.close(resolve);
			}
			else {
				resolve();
			}

			this.server = this.codeCache = null;
		});
	}

	subscribeToSession(sessionId: string, listener: SessionListener) {
		const listeners = this.getSession(sessionId).listeners;
		listeners.push(listener);
		return {
			remove: function () {
				this.remove = function () {};
				pullFromArray(listeners, listener);
			}
		};
	}
}
