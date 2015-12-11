import { OutputStream } from '../../../../../lib/ReporterManager';

export default class MockStream implements OutputStream, NodeJS.WritableStream {
	data = '';
	writable = true;

	listeners: (event: string) => Function[];
	on(type: string, listener: Function) {
		return this;
	}
	once(type: string, listener: Function) {
		return this;
	}
	addListener(type: string, listener: Function) {
		return this;
	}
	removeListener(type: string, listener: Function) {
		return this;
	}
	removeAllListeners() {
		return this;
	}
	setMaxListeners() {
		return this;
	}
	emit(type: string, data: any) {
		return false;
	}

	write(data: Buffer | string) {
		this.data += String(data);
		return true;
	}
	end(data?: Buffer | string) {
		if (data) {
			this.data += String(data);
		}
	}
}
