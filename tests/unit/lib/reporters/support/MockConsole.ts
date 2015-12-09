export default class MockConsole implements Console {
	constructor(hasGrouping: boolean = false) {
		if (hasGrouping) {
			this.group = function (name: string) {
				this.messages.group.push(name);
			};
			this.groupEnd = function () {
				++this.messages.groupEnd;
			};
		}
	}

	messages = {
		debug: <string[]> [],
		info: <string[]> [],
		log: <string[]> [],
		warn: <string[]> [],
		error: <string[]> [],
		group: <string[]> [],
		groupEnd: 0
	};

	assert(test?: boolean, message?: string, ...optionalParams: any[]) {}
	clear() {}
	count(countTitle?: string) {}
	debug(...args: any[]) {
		this.messages.debug.push(args.join(' '));
	}
	dir(value?: any, ...optionalParams: any[]) {}
	dirxml(value: any) {}
	error(...args: any[]) {
		this.messages.error.push(args.join(' '));
	}
	groupCollapsed(groupTitle?: string) {}
	info(...args: any[]) {
		this.messages.info.push(args.join(' '));
	}
	log(...args: any[]) {
		this.messages.log.push(args.join(' '));
	}
	msIsIndependentlyComposed(element: Element) {
		return false;
	}
	profile(reportName?: string) {}
	profileEnd() {}
	select(element: Element) {}
	time(timerName?: string) {}
	timeEnd(timerName?: string) {}
	trace() {}
	warn(...args: any[]) {
		this.messages.warn.push(args.join(' '));
	}

	group: (name: string) => void;
	groupEnd: () => void;
}
