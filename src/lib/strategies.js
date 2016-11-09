// Note that these are JSONWireProtocol strategies. W3C Webdriver only understands 4 strategies:
//   1. css selector
//   2. link text
//   3. partial link text
//   4. xpath
var STRATEGIES = [
	'class name',
	'css selector',
	'id',
	'name',
	'link text',
	'partial link text',
	'tag name',
	'xpath'
];

var SUFFIXES = STRATEGIES.map(function (strategy) {
	return strategy.replace(/(?:^| )([a-z])/g, function (_, letter) {
		return letter.toUpperCase();
	});
});

STRATEGIES.suffixes = SUFFIXES;
STRATEGIES.applyTo = function (prototype) {
	STRATEGIES.forEach(function (strategy, index) {
		var suffix = SUFFIXES[index];

		prototype['findBy' + suffix] = function (value) {
			return this.find(strategy, value);
		};

		prototype['findDisplayedBy' + suffix] = function (value) {
			return this.findDisplayed(strategy, value);
		};

		prototype['waitForDeletedBy' + suffix] = function (value) {
			return this.waitForDeleted(strategy, value);
		};

		if (strategy !== 'id') {
			prototype['findAllBy' + suffix] = function (value) {
				return this.findAll(strategy, value);
			};
		}
	});
};

STRATEGIES.toW3cLocator = function (using, value) {
	switch (using) {
	case 'id':
		using = 'css selector';
		value = '#' + value;
		break;
	case 'class name':
		using = 'css selector';
		value = '.' + value;
		break;
	case 'name':
		using = 'css selector';
		value = '[name="' + value + '"]';
		break;
	case 'tag name':
		using = 'css selector';
		break;
	}

	return { using: using, value: value };
};

module.exports = STRATEGIES;
