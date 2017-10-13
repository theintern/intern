import global from '@dojo/shim/global';

export function log(...args: any[]) {
	if (global.console && global.console.log) {
		global.console.log.apply(global.console, args);
	}
}

export function error(...args: any[]) {
	if (global.console && global.console.error) {
		global.console.error.apply(global.console, args);
	}
}

export function warn(...args: any[]) {
	if (global.console && global.console.warn) {
		global.console.warn.apply(global.console, args);
	}
}
