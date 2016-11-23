export default class MockConsole {
	messages: { [key: string]: string[] } = {};
	constructor(hasGrouping?: boolean) {
		const methods = [ 'log', 'info', 'warn', 'error' ];
		const anyThis = <any> this;

		if (hasGrouping) {
			methods.push('group', 'groupEnd');
		}
		methods.forEach(method => {
			this.messages[method] = [];
			anyThis[method] = (...args: any[]) => {
				this.messages[method].push(Array.prototype.slice.call(args, 0).join(' '));
			};
		});
	}
}
