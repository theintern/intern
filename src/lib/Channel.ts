import request from '@dojo/core/request/providers/xhr';
import Task from '@dojo/core/async/Task';

export default class Channel {
	readonly sessionId: string;

	readonly url: string;

	protected _activeRequest: Task<any>;
	protected _pendingRequest: Task<any>;
	protected _messageBuffer: string[];
	protected _sequence: number;
	protected _maxPostSize: number;

	constructor(options: ChannelOptions) {
		this.sessionId = options.sessionId;
		this.url = options.url;
		this._sequence = 1;
		this._messageBuffer = [];
	}

	/**
	 * Send a message, or schedule it to be sent. Return a promise that resolves when the message has been sent.
	 */
	sendMessage(name: string, data: any) {
		if (data instanceof Error) {
			data = { name: data.name, message: data.message, stack: data.stack };
		}

		return this._sendData(name, data);
	}

	protected _sendData(name: string, data: any) {
		const id = String(this._sequence++);
		const sessionId = this.sessionId;
		const message: Message = { id, sessionId, name, data };

		this._messageBuffer.push(JSON.stringify(message));

		if (this._activeRequest || this._pendingRequest) {
			if (!this._pendingRequest) {
				// Schedule another request after the active one completes
				this._pendingRequest = this._activeRequest.then(() => {
					this._pendingRequest = null;
					return this._send();
				});
			}
			return this._pendingRequest;
		}

		return this._send();
	}

	/**
	 * Send all buffered messages and empty the buffer. Note that the posted data will always be an array of objects.
	 */
	protected _send() {
		// Some testing services have problems handling large message POSTs, so limit the maximum size of
		// each POST body to maxPostSize bytes. Always send at least one message, even if it's more than
		// maxPostSize bytes.
		const sendNextBlock = (): Task<any> => {
			const block = [ messages.shift() ];
			let size = block[0].length;
			while (messages.length > 0 && size + messages[0].length < exports.maxPostSize) {
				size += messages[0].length;
				block.push(messages.shift());
			}

			return request(this.url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(block)
			}).then(() => {
				if (messages.length > 0) {
					return sendNextBlock();
				}
			});
		};

		const messages = this._messageBuffer;
		this._messageBuffer = [];

		this._activeRequest = new Task((resolve, reject) => {
			return sendNextBlock().then(
				() => {
					this._activeRequest = null;
					resolve();
				},
				error => {
					this._activeRequest = null;
					reject(error);
				}
			);
		});

		return this._activeRequest;
	}
}

export function isChannel(value: any): value is Channel {
	return value && typeof value === 'object' && typeof value.sendMessage === 'function';
}

export interface ChannelOptions {
	sessionId: string;
	url: string;
}

export interface Message {
	sessionId: string;
	id: string;
	name: string;
	data: any;
}
