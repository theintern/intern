import BaseChannel, { ChannelOptions, Message } from './Base';
import Task from '@dojo/core/async/Task';

export default class WebSocketChannel extends BaseChannel {
	/** Time to wait for response before rejecting a send */
	timeout: number;

	protected _socket: WebSocket;
	protected _sendQueue: { [key: string]: () => void };
	protected _ready: Task<any>;
	protected _sequence: number;

	constructor(options: ChannelOptions) {
		super(options);

		if (this.timeout == null) {
			this.timeout = 1000;
		}

		if (!options.port) {
			throw new Error('A port is required for a WebSocket channel');
		}

		this._socket = new WebSocket(`ws://localhost:${options.port}`);

		this._ready = new Task(resolve => {
			this._socket.addEventListener('open', resolve);
		});

		this._socket.addEventListener('message', event => {
			this._handleMessage(JSON.parse(event.data));
		});

		this._sendQueue = {};
		this._sequence = 1;
	}

	protected _sendData(name: string, data: any) {
		try {
			const id = String(this._sequence++);
			const sessionId = this.sessionId;
			const message: Message = { id, sessionId, name, data };

			return this._ready.then(() => new Task<void>((resolve, reject) => {
				this._socket.send(JSON.stringify(message));

				const timer = setTimeout(() => {
					reject(new Error('Send timed out'));
				}, this.timeout);

				this._sendQueue[id] = () => {
					clearTimeout(timer);
					resolve();
				};
			}));
		}
		catch (error) {
			return Task.reject<void>(error);
		}
	}

	protected _handleMessage(message: any) {
		const id = message.id;
		this._sendQueue[id]();
		this._sendQueue[id] = null;
	}
}
