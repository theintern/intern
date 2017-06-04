import request from '@dojo/core/request/providers/xhr';
import Task from '@dojo/core/async/Task';
import { RemoteEvents } from '../RemoteSuite';
import BaseChannel, { ChannelOptions, Message } from './Base';

export default class HttpChannel extends BaseChannel {
	protected _lastRequest: Task<void>;
	protected _messageBuffer: string[];
	protected _sequence: number;
	protected _maxPostSize: number;

	constructor(options: HttpChannelOptions) {
		super(options);
		this._sequence = 1;
		this._maxPostSize = options.maxPostSize || 100000;
		this._messageBuffer = [];
		this._lastRequest = Task.resolve();
	}

	protected _sendData(name: keyof RemoteEvents, data: any) {
		const id = String(this._sequence++);
		const sessionId = this.sessionId;
		const message: Message = { id, sessionId, name, data };

		this._messageBuffer.push(JSON.stringify(message));

		return this._lastRequest = this._lastRequest.then(() => this._send());
	}

	/**
	 * If there are messages to send, send them.
	 */
	protected _send() {
		if (this._messageBuffer.length === 0) {
			return Task.resolve();
		}
		return this._sendMessages();
	}

	/**
	 * Some testing services have problems handling large message POSTs, so limit the maximum size of each POST body to
	 * maxPostSize bytes. Always send at least one message, even if it's more than maxPostSize bytes.
	 */
	protected _sendMessages(): Task<void> {
		const messages = this._messageBuffer;
		const block = [ messages.shift()! ];

		let size = block[0].length;
		while (messages.length > 0 && size + messages[0].length < this._maxPostSize) {
			size += messages[0].length;
			block.push(messages.shift()!);
		}

		return request(this.url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(block)
		}).then(() => {
			if (messages.length > 0) {
				return this._sendMessages();
			}
		});
	}
}

export interface HttpChannelOptions extends ChannelOptions {
	maxPostSize?: number;
}
