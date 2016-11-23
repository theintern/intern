export default class MockStream {
	data: string = '';

	private _mockAction(data: string, encoding?: string, callback?: Function) {
		this.data += data;
		callback && callback();
	}

	end(data: string, encoding?: string, callback?: Function): void {
		this._mockAction(data, encoding, callback);
	}

	write(data: string, encoding?: string, callback?: Function): void {
		this._mockAction(data, encoding, callback);
	}
}
