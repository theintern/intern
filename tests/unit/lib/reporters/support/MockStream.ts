export default class MockStream {
	data = '';

	private _mockAction(data: string, _encoding?: string, callback?: Function) {
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
