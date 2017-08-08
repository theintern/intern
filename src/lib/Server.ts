import { pullFromArray } from './common/util';
import { normalizePath } from './node/util';
import { after } from '@dojo/core/aspect';
import { createServer, IncomingMessage, Server as HttpServer, ServerResponse } from 'http';
import { basename, join, resolve } from 'path';
import { lookup } from 'mime-types';
import { Socket } from 'net';
import { mixin } from '@dojo/core/lang';
import { Handle } from '@dojo/interfaces/core';
import Task from '@dojo/core/async/Task';
import Node from './executors/Node';
import { Message } from './channels/Base';
import * as WebSocket from 'ws';

export default class Server implements ServerProperties {
	/** Executor managing this Server */
	readonly executor: Node;

	/** Base path to resolve file requests against */
	basePath: string;

	/** Port to use for HTTP connections */
	port: number;

	/** If true, wait for emit handlers to complete before responding to a message */
	runInSync: boolean;

	/** Port to use for WebSocket connections */
	socketPort: number;

	protected _httpServer: HttpServer | null;
	protected _readTasks: { [filename: string]: Task<any>; } | null;
	protected _sessions: { [id: string]: { listeners: ServerListener[] } };
	protected _wsServer: WebSocket.Server | null;

	constructor(options: ServerOptions) {
		mixin(this, {
			basePath: '.',
			runInSync: false
		}, options);
	}

	start() {
		return new Promise<void>((resolve) => {
			const server = this._httpServer = createServer((request: IncomingMessage, response: ServerResponse) => {
				return this._handleHttp(request, response);
			});
			this._readTasks = Object.create(null);
			this._sessions = {};

			const sockets: Socket[] = [];

			this._wsServer = new WebSocket.Server({ port: this.port + 1 });
			this._wsServer.on('connection', client => {
				this.executor.log('WebSocket connection opened:', client);
				this._handleWebSocket(client);
			});
			this._wsServer.on('error', error => {
				this.executor.emit('error', error);
			});

			// If sockets are not manually destroyed then Node.js will keep itself running until they all expire
			after(server, 'close', function () {
				let socket: Socket | undefined;
				while ((socket = sockets.pop())) {
					socket.destroy();
				}
			});

			server.on('connection', socket => {
				sockets.push(socket);
				this.executor.log('HTTP connection opened,', sockets.length, 'open connections');

				socket.on('close', () => {
					let index = sockets.indexOf(socket);
					index !== -1 && sockets.splice(index, 1);
					this.executor.log('HTTP connection closed,', sockets.length, 'open connections');
				});
			});

			server.listen(this.port, () => {
				resolve();
			});
		});
	}

	stop() {
		this.executor.log('Stopping server...');
		const promises: Promise<any>[] = [];

		if (this._readTasks) {
			Object.keys(this._readTasks).forEach(filename => {
				this._readTasks![filename].cancel();
			});
		}

		if (this._httpServer) {
			promises.push(new Promise(resolve => {
				this._httpServer!.close(resolve);
			}).then(() => {
				this.executor.log('Stopped http server');
				this._httpServer = null;
			}));
		}

		if (this._wsServer) {
			promises.push(new Promise(resolve => {
				this._wsServer!.close(resolve);
			}).then(() => {
				this.executor.log('Stopped ws server');
				this._wsServer = null;
			}));
		}

		return Promise.all(promises).then(() => {
			this._readTasks = null;
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

	private _handleHttp(request: IncomingMessage, response: ServerResponse) {
		if (request.method === 'GET' || request.method === 'HEAD') {
			this._handleFile(request, response, request.method === 'HEAD');
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

					this.executor.log('Received HTTP messages');

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
		omitContent?: boolean
	) {
		const file = /^\/+([^?]*)/.exec(request.url!)![1];
		let wholePath: string;

		this.executor.log('Request for', file);

		if (/^__intern\//.test(file)) {
			wholePath = join(this.executor.config.internPath, file.replace(/^__intern\//, ''));
		}
		else {
			wholePath = resolve(join(this.basePath, file));
		}

		wholePath = normalizePath(wholePath);

		if (wholePath.charAt(wholePath.length - 1) === '/') {
			wholePath += 'index.html';
		}

		if (this._readTasks![wholePath]) {
			return this._readTasks![wholePath];
		}

		return this._readTasks![wholePath] = this.executor.readFile(wholePath, omitContent)
			.then(({ size, data }) => {
				this.executor.log('Serving', wholePath);

				const contentType = lookup(basename(wholePath)) || 'application/octet-stream';

				response.writeHead(200, {
					'Content-Type': contentType,
					'Content-Length': size
				});

				if (data === null) {
					response.end();
				}
				else {
					response.end(data, (error?: Error) => {
						if (error) {
							this.executor.emit('error', new Error(`Error serving ${wholePath}: ${error.message}`));
						}
						else {
							this.executor.log('Served', wholePath);
						}
					});
				}
			})
			.catch(error => {
				this.executor.log('Error serving', wholePath, ':', error);
				this._send404(response);
			})
			.finally(() => {
				delete this._readTasks![wholePath];
			})
		;
	}

	private _handleMessage(message: Message): Promise<any> {
		this.executor.log('Processing message [', message.id, '] for ', message.sessionId, ': ', message.name);
		const promise = this._publish(message);
		let shouldWait = getShouldWait(this.runInSync, message);
		if (shouldWait) {
			promise.catch(error => {
				this.executor.emit('error', error);
			});
			return resolvedPromise;
		}
		return promise;
	}

	private _handleWebSocket(client: WebSocket) {
		client.on('message', data => {
			this.executor.log('Received WebSocket message');
			const message: Message = JSON.parse(data);
			this._handleMessage(message)
				.catch(error => this.executor.emit('error', error))
				.then(() => {
					// Don't send acks for runEnd, because by the remote will hev been shut down by the time we get
					// here.
					if (message.name !== 'runEnd') {
						this.executor.log('Sending ack for [', message.id, ']');
						client.send(JSON.stringify({ id: message.id }), error => {
							if (error) {
								this.executor.emit('error', new Error(`Error sending ack for [ ${message.id} ]: ${error.message}`));
							}
						});
					}
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
