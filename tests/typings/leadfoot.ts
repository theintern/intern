import Command = require('leadfoot/Command');

declare var remote: Command<any>;

remote
	.findDisplayed('css selector', 'bar')
	.findDisplayedByClassName('css selector')
	.findDisplayedByCssSelector('css selector')
	.findDisplayedById('css selector')
	.findDisplayedByName('css selector')
	.findDisplayedByLinkText('css selector')
	.findDisplayedByPartialLinkText('css selector')
	.findDisplayedByTagName('css selector')
	.findDisplayedByXpath('css selector')

	.then((element) => {
		element.findDisplayed('tag name', 'h1');
		element.findDisplayedByClassName('h1');
		element.findDisplayedByCssSelector('h1');
		element.findDisplayedById('h1');
		element.findDisplayedByName('css selector');
		element.findDisplayedByLinkText('css selector');
		element.findDisplayedByPartialLinkText('css selector');
		element.findDisplayedByTagName('css selector');
		element.findDisplayedByXpath('css selector');
	})

	.then(function (this: Command<any>) {
		const session = this.session;
		session.findDisplayed('tag name', 'h1');
		session.findDisplayedByClassName('h1');
		session.findDisplayedByCssSelector('h1');
		session.findDisplayedById('h1');
		session.findDisplayedByName('css selector');
		session.findDisplayedByLinkText('css selector');
		session.findDisplayedByPartialLinkText('css selector');
		session.findDisplayedByTagName('css selector');
		session.findDisplayedByXpath('css selector');
	});
