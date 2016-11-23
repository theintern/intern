export class EnvironmentType {
	browserName: string = undefined;

	version: string = undefined;

	platform: string = undefined;

	platformVersion: string = undefined;

	constructor(kwArgs: { [key: string]: any }) {
		const anyThis = <any> this;
		for (let k in kwArgs) {
			anyThis[k] = kwArgs[k];
		}
	}

	toString() {
		let parts: string[] = [];

		parts.push(this.browserName || 'Any browser');
		this.version && parts.push(this.version);
		parts.push('on ' + (this.platform || 'any platform'));
		this.platformVersion && parts.push(this.platformVersion);

		return parts.join(' ');
	}
}
