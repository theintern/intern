# Architecture

<!-- vim-markdown-toc GFM -->

* [Main components](#main-components)
* [API](#api)
	* [Session vs Element](#session-vs-element)
	* [Element context](#element-context)
* [Helpers](#helpers)

<!-- vim-markdown-toc -->

## Main components

A program will generally interact with three main components of Leadfoot:

1. A [Server], which manages communication with a remote WebDriver server
1. A [Session], which manages communication with a single remote browser instance
1. A [Command], which provides an API for interacting with a remote browser

## API

Much of Leadfoot’s API is provided by the [Command] class. Commands are Promise-like, and the Command API is fluid and asynchronous. A sequence of commands to load a remote page, find a button, and click it typically looks like:

```js
command
    .get('http://page.local')
    .findById('submit-button')
    .click()
```

Methods in a Command chain execute asynchronously and sequentially. Each method will wait for the previous one in the chain to complete. If multiple Command chains are started, they will run in parallel (as much as JavaScript supports running code in parallel).

### Session vs Element

Commands support both **session** interactions, which operate against the entire browser session, and **element** interactions, which operate against specific elements taken from the currently loaded page. Things like navigating the browser with `get`, moving the mouse cursor, and executing scripts are session interactions, while getting text displayed on the page, typing into form fields, and getting element attributes are element interactions.

Some method names, like `click`, are identical for both Session and [Element] APIs; in this case, the element APIs are suffixed with the word `Element` in order to identify them uniquely.

### Element context

Session interactions can be performed at any time, from any Command. On the other hand, to perform element interactions, you first need to retrieve one or more elements to interact with. This can be done using any of the `find` or `findAll` methods, by the `getActiveElement` method, or by returning elements from `execute` or `executeAsync` calls. The retrieved elements are stored internally as the *element context* of the Command chain. When element methods, such as `getVisibleText`, are called on a Command, they operate on the current context.

```js
command.get('http://example.com')
    // finds one element -> single element context
    .findByTagName('h1')
    .getVisibleText()
    .then(text => {
        // `text` is the text from the element context
    });
```

When an element method is called and the current context is a multi-element, the result will be returned as an array:

```js
command.get('http://example.com')
    // finds multiple elements -> multiple element context
    .findAllByTagName('p')
    .getVisibleText()
    .then(texts => {
        // `texts` is an array of text from each of the `p` elements
    });
```

The `find` and `findAll` methods also operate on the current context. If a command has been filtered by element, the `find` and `findAll` commands will only find elements *within* the current context. Otherwise, they will find elements throughout the page.

## Helpers

“Helpers” are functions that can be inserted into a Command chain to provide higher-level functionality. For example, Leadfoot includes a [pollUntil] helper. This function can be used to pause a Command chain until a condition is met. For example, the following snippet will retrieve a page and then wait for a `ready` global variable to be defined on the page:

```js
import pollUntil from '@theintern/leadfoot/helpers/pollUntil';

command
    .get('http://example.com')
	.then(pollUntil('return window.ready', 5000))
	.findByTagName('h1')
	// ...
```

[Command]: https://theintern.io/docs.html#Leadfoot/2/api/Command
[Element]: https://theintern.io/docs.html#Leadfoot/2/api/Element
[Server]: https://theintern.io/docs.html#Leadfoot/2/api/Server
[Session]: https://theintern.io/docs.html#Leadfoot/2/api/Session
[pollUntil]: https://theintern.io/docs.html#Leadfoot/2/api/helpers%2FpollUntil
