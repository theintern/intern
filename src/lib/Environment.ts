export default class Environment {
	browser?: string;
	browserName: string;
	version: string;
	platform: string;
	platformName?: string;
	platformVersion: string;
	device?: string;

	constructor(kwArgs: { [key: string]: any }) {
		const anyThis = <any> this;
		for (let k in kwArgs) {
			anyThis[k] = kwArgs[k];
		}
	}

	toString() {
		let parts: string[] = [];

		parts.push(this.browserName || this.browser || 'Any browser');
		this.version && parts.push(this.version);
		parts.push(`on ${this.platformName || this.platform || 'any platform'}`);
		this.platformVersion && parts.push(this.platformVersion);
		if (this.device) {
			parts.push(`(${this.device})`);
		}

		return parts.join(' ');
	}
}
