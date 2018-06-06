const config = require('@theintern/dev/prettier.config');

config.overrides = [
	{
		files: '*.md',
		options: {
			useTabs: false
		}
	}
];

module.exports = config;
