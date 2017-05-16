import { pullFromArray } from './common/util';
import { normalizePath } from './node/util';
import { after } from '@dojo/core/aspect';
import { createServer, IncomingMessage, Server as HttpServer, ServerResponse } from 'http';
import { basename, join, resolve } from 'path';
import { createReadStream, stat, readFile } from 'fs';
import { lookup } from 'mime-types';
import { Socket } from 'net';
import { mixin } from '@dojo/core/lang';
import { Handle } from '@dojo/interfaces/core';
import Node from './executors/Node';
import { Message } from './channels/Base';
import Promise from '@dojo/shim/Promise';
import WebSocket = require('ws');

export default class Server implements ServerProperties {
	basePath: string;

	executor: Node;

	port: number;

	runInSync: boolean;

	server: HttpServer | null;

	socketPort: number;

	private _wsServer: WebSocket.Server | null;

	private _codeCache: { [filename: string]: { mtime: number, data: string } } | null;

	private _sessions: { [id: string]: { listeners: ServerListener[] } };

	constructor(options: ServerOptions) {
		mixin(this, options);
	}

	start() {
		return new Promise((resolve) => {
			const server = this.server = createServer((request: IncomingMessage, response: ServerResponse) => {
				return this._handler(request, response);
			});
			this._sessions = {};
			this._codeCache = {};

			const sockets: Socket[] = [];

			// If sockets are not manually destroyed then Node.js will keep itself running until they all expire
			after(server, 'close', function () {
				let socket: Socket | undefined;
				while ((socket = sockets.pop())) {
					socket.destroy();
				}
			});

			server.on('connection', socket => {
				this.executor.log('HTTP connection opened');
				sockets.push(socket);

				// Disabling Nagle improves server performance on low-latency connections, which are more common
				// during testing than high-latency connections
				socket.setNoDelay(true);

				socket.on('close', function () {
					let index = sockets.indexOf(socket);
					index !== -1 && sockets.splice(index, 1);
				});
			});

			this._wsServer = new WebSocket.Server({ port: this.port + 1 });
			this._wsServer.on('connection', client => {
				this.executor.log('WebSocket connection opened:', client);
				this._handleWebSocket(client);
			});
			this._wsServer.on('error', error => {
				this.executor.emit('error', error);
			});

			server.listen(this.port, resolve);
		});
	}

	stop() {
		const promises: Promise<any>[] = [];

		if (this.server) {
			promises.push(new Promise(resolve => {
				this.server!.close(resolve);
			}).then(() => {
				this.server = null;
			}));
		}

		if (this._wsServer) {
			promises.push(new Promise(resolve => {
				this._wsServer!.close(resolve);
			}).then(() => {
				this._wsServer = null;
			}));
		}

		return Promise.all(promises).then(() => {
			this._codeCache = null;
		});
	}

	/**
	 * Listen for all events for a specific session
	 */
	subscribe(sessionId: string, listener: ServerListener): Handle {
		const listeners = this._getSession(sessionId).listeners;
		listeners.push(listener);
		return {
			destroy: function (this: any) {
				this.destroy = function () { };
				pullFromArray(listeners, listener);
			}
		};
	}

	private _getSession(sessionId: string) {
		let session = this._sessions[sessionId];
		if (!session) {
			session = this._sessions[sessionId] = { listeners: [] };
		}
		return session;
	}

	private _handler(request: IncomingMessage, response: ServerResponse) {
		if (request.method === 'GET') {
			if (/\.js(?:$|\?)/.test(request.url!)) {
				this._handleFile(request, response, true);
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
					let rawMessages: any = JSON.parse(data);

					if (!Array.isArray(rawMessages)) {
						rawMessages = [rawMessages];
					}

					const messages: Message[] = rawMessages.map(function (messageString: string) {
						return JSON.parse(messageString);
					});

					Promise.all(messages.map(message => this._handleMessage(message))).then(
						() => {
							response.statusCode = 204;
							response.end();
						},
						() => {
							response.statusCode = 500;
							response.end();
						}
					);
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

	private _handleFile(
		request: IncomingMessage,
		response: ServerResponse,
		shouldInstrument?: boolean,
		omitContent?: boolean
	) {
		function send(contentType: string, data: string) {
			response.writeHead(200, {
				'Content-Type': contentType,
				'Content-Length': Buffer.byteLength(data)
			});
			response.end(data);
		}

		const file = /^\/+([^?]*)/.exec(request.url!)![1];
		let wholePath: string;

		this.executor.log('Request for', file);

		if (/^__intern\//.test(file)) {
			wholePath = join(this.executor.config.internPath, file.replace(/^__intern\//, ''));
			shouldInstrument = false;
		}
		else {
			wholePath = resolve(join(this.basePath, file));
		}

		wholePath = normalizePath(wholePath);

		if (wholePath.charAt(wholePath.length - 1) === '/') {
			wholePath += 'index.html';
		}

		const contentType = lookup(basename(wholePath)) || 'application/octet-stream';
		stat(wholePath, (error, stats) => {
			// The server was stopped before this file was served
			if (!this.server) {
				return;
			}

			if (error || !stats.isFile()) {
				this.executor.log('Unable to serve', wholePath);
				this._send404(response);
				return;
			}

			this.executor.log('Serving', wholePath);

			if (shouldInstrument && this.executor.shouldInstrumentFile(wholePath)) {
				const mtime = stats.mtime.getTime();
				const codeCache = this._codeCache!;
				if (codeCache[wholePath] && codeCache[wholePath].mtime === mtime) {
					send(contentType, codeCache[wholePath].data);
				}
				else {
					readFile(wholePath, 'utf8', (error, data) => {
						// The server was stopped in the middle of the file read
						if (!this.server) {
							return;
						}

						if (error) {
							this._send404(response);
							return;
						}

						// providing `wholePath` to the instrumenter instead of a partial filename is necessary because
						// lcov.info requires full path names as per the lcov spec
						data = this.executor.instrumentCode(data, wholePath);
						codeCache[wholePath] = {
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
					createReadStream(wholePath).pipe(response);
				}
			}
		});
	}

	private _handleMessage(message: Message): Promise<any> {
		this.executor.log('Received message:', message);
		const promise = this._publish(message);
		let shouldWait = getShouldWait(this.runInSync, message);
		return shouldWait ? promise : resolvedPromise;
	}

	private _handleWebSocket(client: WebSocket) {
		client.on('message', data => {
			const message: Message = JSON.parse(data);
			this._handleMessage(message)
				.catch(error => this.executor.emit('error', error))
				.then(() => {
					client.send(JSON.stringify({ id: message.id }), error => {
						if (error) {
							this.executor.emit('error', error);
						}
					});
				});
		});

		client.on('error', error => {
			this.executor.log('WebSocket client error:', error);
			this.executor.emit('error', error);
		});
	}

	private _publish(message: Message) {
		const listeners = this._getSession(message.sessionId).listeners;
		return Promise.all(listeners.map(listener => listener(message.name, message.data)));
	}

	private _send404(response: ServerResponse) {
		response.writeHead(404, {
			'Content-Type': 'text/html;charset=utf-8'
		});
		response.end(`<!DOCTYPE html><title>404 Not Found</title><h1>404 Not Found</h1>` +
			`<!-- ${new Array(512).join('.')} -->`);
	}
}

export interface ServerProperties {
	basePath: string;
	executor: Node;
	port: number;
	runInSync: boolean;
	socketPort: number;
}

export interface ServerListener {
	(name: string, data: any): void;
}

export type ServerOptions = Partial<ServerProperties> & { executor: Node };

const resolvedPromise = Promise.resolve();

/**
 * Indicate whether Server should wait for an event to process before sending an acknowlegement.
 */
function getShouldWait(waitMode: (string|boolean), message: Message) {
	let shouldWait = false;
	let eventName = message.name;

	if (waitMode === 'fail') {
		if (
			(eventName === 'testEnd' && message.data.error) ||
			(eventName === 'suiteEnd' && message.data.error) ||
			eventName === 'error'
		) {
			shouldWait = true;
		}
	}
	else if (waitMode === true) {
		shouldWait = true;
	}
	else if (Array.isArray(waitMode) && waitMode.indexOf(eventName) !== -1) {
		shouldWait = true;
	}

	return shouldWait;
}
