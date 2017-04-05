import Node from '../executors/Node';
import WebDriver from '../executors/WebDriver';
import Task from '@dojo/core/async/Task';

export default function run(rawConfig: any) {
	return new Task<void>((resolve, reject) => {
		const isWebDriver = rawConfig.webdriver;

		if (isWebDriver) {
			WebDriver.initialize(rawConfig);
		}
		else {
			Node.initialize(rawConfig);
		}

		intern.run().then(resolve, reject);
	});
}
