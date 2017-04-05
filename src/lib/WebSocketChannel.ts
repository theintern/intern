import Channel, { ChannelOptions, Message } from './Channel';
import Task from '@dojo/core/async/Task';

export default class WebSocketChannel extends Channel {
	protected _socket: WebSocket;
	protected _sendQueue: { [key: string]: () => void };
	protected _ready: Task<any>;

	constructor(options: WebSocketOptions) {
		super(options);

		this._socket = new WebSocket(`ws://localhost:${options.port}`);

		this._ready = new Task(resolve => {
			this._socket.addEventListener('open', resolve);
		});

		this._socket.addEventListener('message', event => {
			this._handleMessage(JSON.parse(event.data));
		});

		this._sendQueue = {};
	}

	protected _sendData(name: string, data: any): Task<any> {
		try {
			const id = String(this._sequence++);
			const sessionId = this.sessionId;
			const message: Message = { id, sessionId, name, data };

			return this._ready.then(() => {
				return new Task(resolve => {
					this._socket.send(JSON.stringify(message));
					this._sendQueue[id] = resolve;
				});
			});
		}
		catch (error) {
			return Task.reject(error);
		}
	}

	protected _handleMessage(message: any) {
		const id = message.id;
		this._sendQueue[id]();
		this._sendQueue[id] = null;
	}
}

export interface WebSocketOptions extends ChannelOptions {
	port: number;
}
