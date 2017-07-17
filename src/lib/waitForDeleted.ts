import Task from '@dojo/core/async/Task';
import statusCodes from './statusCodes';
import Session from '../Session';
import Element from '../Element';

import { Strategy } from './Locator';

export default function waitForDeleted(session: Session, locator: Session | Element, using: Strategy, value: string) {
	let originalTimeout: number;

	return session.getTimeout('implicit').then(function (value) {
		originalTimeout = value;
		session.setTimeout('implicit', 0);
	}).then(function () {
		return new Task((resolve, reject) => {
			const startTime = Date.now();

			(function poll() {
				if (Date.now() - startTime > originalTimeout) {
					const always = function () {
						const error: any = new Error();
						error.status = 21;
						const [ name, message ] = (<any> statusCodes)[error.status];
						error.name = name;
						error.message = message;
						reject(error);
					};
					session.setTimeout('implicit', originalTimeout).then(always, always);
					return;
				}

				locator.find(using, value).then(poll, function (error) {
					const always = function () {
						/* istanbul ignore else: other errors should never occur during normal operation */
						if (error.name === 'NoSuchElement') {
							resolve();
						}
						else {
							reject(error);
						}
					};
					session.setTimeout('implicit', originalTimeout).then(always, always);
				});
			})();

		});
	}).then(() => {});
}
