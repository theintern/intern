import request from '@dojo/core/request/providers/xhr';
import Task from '@dojo/core/async/Task';
import { RemoteEvents } from '../RemoteSuite';
import BaseChannel, { ChannelOptions, Message } from './Base';

export default class HttpChannel extends BaseChannel {
	protected _activeRequest: Task<any>;
	protected _pendingRequest: Task<any>;
	protected _messageBuffer: string[];
	protected _sequence: number;
	protected _maxPostSize: number;

	constructor(options: ChannelOptions) {
		super(options);
		this._sequence = 1;
		this._messageBuffer = [];
	}

	protected _sendData(name: keyof RemoteEvents, data: any) {
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
