export default class EnvironmentType {
	constructor(kwArgs: EnvironmentType.KwArgs) {
		for (let k in kwArgs) {
			(<any> this)[k] = (<any> kwArgs)[k];
		}
	}

	browserName: string;
	version: string;
	platform: string;
	platformVersion: string;

	toString() {
		const parts: string[] = [];

		parts.push(this.browserName || 'Any browser');
		this.version && parts.push(this.version);
		parts.push('on ' + (this.platform || 'any platform'));
		this.platformVersion && parts.push(this.platformVersion);

		return parts.join(' ');
	}
}

namespace EnvironmentType {
	export interface KwArgs {
		browserName?: string;
		version?: string;
		platform?: string;
		platformVersion?: string;
	}
}
