export default class MockStream {
	data = '';
	end(data: string, encoding?: string, callback?: () => void) {
		this.data += data;
		callback && callback();
	}
}
