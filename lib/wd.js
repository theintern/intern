/*jshint node:true */
define([
	'dojo/node!wd',
	'dojo/node!wd/lib/webdriver',
	'dojo/node!wd/lib/element',
	'dojo/node!wd/lib/utils',
	'dojo/node!path',
	'dojo/promise/when',
	'dojo/Deferred',
	'dojo/topic',
	'./util'
], function (wd, WebDriver, Element, wdUtils, pathUtils, when, Deferred, topic, util) {
	if (!wd) {
		throw new Error('wd cannot be loaded in a browser environment');
	}

	// wd APIs are pretty awful
	if (Element.element) {
		Element = Element.element;
	}

	// Simplify moving mouse to an element
	if (!Element.prototype.moveTo) {
		Element.prototype.moveTo = function (offsetX, offsetY, cb) {
			this.browser.moveTo(this, offsetX, offsetY, cb);
		};
	}

	/**
	 * A hash map of names of methods that accept an element as the first argument.
	 */
	var elementArgumentMethods = {
		clickElement: true,
		submit: true,
		text: true,
		getTagName: true,
		clear: true,
		isSelected: true,
		getAttribute: true,
		getValue: true,
		isDisplayed: true,
		getLocation: true,
		getSize: true,
		getComputedCss: true,
		moveTo: true,
		flick: true,
		isVisible: true,
		// `type` must be used with element context or else this happens in Safari:
		// https://code.google.com/p/selenium/issues/detail?id=4996
		type: true
	};

	/**
	 * A hash map of names of methods that operate using an element as the context. Only methods that do not have an
	 * entry in `elementArgumentMethods` of the same name are listed here, since they are just proxies back to those
	 * master methods.
	 */
	var elementContextMethods = {
		click: true,
		textPresent: true,
		equals: true
	};

	wdUtils.elementFuncTypes.forEach(function (type) {
		type = wdUtils.elFuncSuffix(type);

		[ 'element_',
			'element_OrNull',
			'element_IfExists',
			'waitForElement_',
			'waitForVisible_',
			'elements_'
		].forEach(function (wrapper) {
			var name = wrapper.replace('_', type);
			elementContextMethods[name] = true;
		});
	});

	/**
	 * A WebDriver instance with Promises/A interface methods instead of Node.js callback-style methods.
	 *
	 * @property {string} sessionId The session ID of the current remote session. Undefined until the session is
	 * successfully initialised using {@link init}.
	 *
	 * @property {function(desiredCapabilities:Object):PromisedWebDriver -> string} init
	 * Creates a new remote session with the desired capabilities. The first argument is a capabilities object.
	 * Resolves to the session ID of the new session. This method should never be called directly by testing code.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session
	 *
	 * @property {function():PromisedWebDriver -> Object} status
	 * Retrieves the status of the server. Resolves to an object with information on the server status.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/status
	 *
	 * @property {function():PromisedWebDriver -> Array.<Object>} sessions
	 * Retrieves a list of active sessions on the current server. Resolves to an array of objects containing the
	 * ID and map of capabilities for each session.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/sessions
	 *
	 * @property {function():PromisedWebDriver -> Object} sessionCapabilities
	 * Retrieves the list of capabilities defined for the current session. Resolves to a hash map of the capabilities
	 * of the current session.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId
	 *
	 * @property {function(url:string, name:string=):PromisedWebDriver} newWindow
	 * Opens a new window (using `window.open`) with the given URL and optionally a name for the new window.
	 * The window can later be accessed by name with the {@link window} method, or by getting the last handle
	 * returned by the {@link windowHandles} method.
	 *
	 * @property {function():PromisedWebDriver} close
	 * Closes the currently focused window.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#DELETE_/session/:sessionId/window
	 *
	 * @property {function(name:string):PromisedWebDriver} window
	 * Changes focus to the window with the given name.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/window
	 *
	 * @property {function(id:(string|number|Element)):PromisedWebDriver} frame
	 * Changes focus to the frame (like `window.frames`) with the given name, index, or explicit element reference.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/frame
	 *
	 * @property {function():PromisedWebDriver -> string} windowName
	 * Retrieves the name of the currently focused window.
	 *
	 * @property {function():PromisedWebDriver -> string} windowHandle
	 * Retrieves the current window handle.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/window_handle
	 *
	 * @property {function():PromisedWebDriver -> Array.<string>} windowHandles
	 * Retrieves all window handles currently available within the session.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/window_handles
	 *
	 * @property {function():PromisedWebDriver} quit
	 * Destroys the current session. This method should never be called by testing code.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#DELETE_/session/:sessionId
	 *
	 * @property {function(code:string):PromisedWebDriver -> *} eval
	 * Evaluates the given code using the `eval` function of the remote browser. Resolves to the value of the
	 * evaluated expression. It is recommended that `execute` be used instead of this function when possible.
	 *
	 * @property {function(code:string|Function):PromisedWebDriver -> *} execute
	 * Executes the given code or function within the remote browser. Resolves to the return value of the function.
	 * When a string is passed, it is invoked as with `new Function`. If a function is passed, it is serialised and
	 * passed to the remote browser, so when executed does not have access to anything from the original lexical scope.
	 * If the resolved value of an `execute` method is an Element, the element will be set as the current context for
	 * element-specific methods.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/execute
	 *
	 * @property {function(code:string|Function, args:Array=):PromisedWebDriver -> *} executeAsync
	 * Executes the given code or function within the remote browser, expecting that the code will invoke the callback
	 * that gets passed as the final argument to the function. For example:
	 *
	 * <pre>
	 * remote.executeAsync(function (timeout, callback) {
	 *     setTimeout(function () {
	 *         callback('returnValue');
	 *     }, timeout);
	 * }, [ 1000 ]);
	 * </pre>
	 *
	 * Note that `executeAsync` may not be supported by all Selenium drivers.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/execute_async
	 *
	 * @property {function(url:string):PromisedWebDriver} get
	 * Navigates the currently focused window to the given URL. Resolves when the browser `window.onload` event
	 * fires.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/url
	 *
	 * @property {function():PromisedWebDriver} refresh
	 * Refreshes the currently focused window.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/refresh
	 *
	 * @property {function(handle:string):PromisedWebDriver} maximize
	 * Maximises the window specified by `handle` if not already maximised. The special handle value "current" may be
	 * used to maximise the currently focused window.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/window/:windowHandle/maximize
	 *
	 * @property {function(handle:string=):PromisedWebDriver -> { width:number, height:number }} getWindowSize
	 * Gets the size of the window specified by `handle`. If no handle is specified, the size of the currently focused
	 * window is retrieved.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/window/:windowHandle/size
	 *
	 * @property {function(width:number, height:number, handle:string=):PromisedWebDriver} setWindowSize
	 * Sets the size of the window specified by `handle`. If no handle is specified, the size of the currently focused
	 * window is set.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/window/:windowHandle/size
	 *
	 * @property {function(handle:string=):PromisedWebDriver -> { x: number, y: number }} getWindowPosition
	 * Gets the position of the window specified by `handle`, relative to the top-left corner of the screen. If no
	 * handle is specified, the position of the currently focused window is retrieved.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/window/:windowHandle/position
	 *
	 * @property {function(x:number, y:number, handle:string=):PromisedWebDriver} setWindowPosition
	 * Sets the position of the window specified by `handle`, relative to the top-left corner of the screen. If no
	 * handle is specified, the position of the currently focused window is set.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/window/:windowHandle/position
	 *
	 * @property {function():PromisedWebDriver} forward
	 * Navigates forward in the browser history.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/forward
	 *
	 * @property {function():PromisedWebDriver} back
	 * Navigates backwards in the browser history.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/back
	 *
	 * @property {function(milliseconds:number):PromisedWebDriver} setImplicitWaitTimeout
	 * Sets the maximum amount of time the remote driver should poll for elements before giving up, in milliseconds.
	 * Defaults to 0ms (give up immediately).
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/timeouts/implicit_wait
	 *
	 * @property {function(milliseconds:number):PromisedWebDriver} setAsyncScriptTimeout
	 * Sets the maximum amount of time the remote driver should wait for an asynchronous script to execute its callback
	 * before giving up, in milliseconds.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/timeouts/async_script
	 *
	 * @property {function(milliseconds:number):PromisedWebDriver} setPageLoadTimeout
	 * Sets the maximum amount of time the remote driver should wait for a page to finish loading before giving up,
	 * in milliseconds.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/timeouts
	 *
	 * @property {function():PromisedWebDriver -> string} takeScreenshot
	 * Takes a screenshot of the current page. Resolves to a base64-encoded PNG of the current page.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/screenshot
	 *
	 * @property {function(className:string):PromisedWebDriver -> Element} elementByClassName
	 * Retrieves the first element matching the given CSS class. If no such element exists, an error is raised.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element
	 *
	 * @property {function(className:string):PromisedWebDriver -> Element} elementByClassNameIfExists
	 * Retrieves the first element matching the given CSS class, or `undefined` if no such element exists.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element
	 *
	 * @property {function(className:string, timeout:number):PromisedWebDriver} waitForVisibleByClassName
	 * Waits until the first element matching the given CSS class becomes visible. If the element does not become
	 * visible before the timeout (in milliseconds), an error is raised.
	 *
	 * @property {function(className:string):PromisedWebDriver -> Array.<Element>} elementsByClassName
	 * Retrieves all elements matching the given CSS class.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/elements
	 *
	 * @property {function(selector:string):PromisedWebDriver -> Element} elementByCssSelector
	 * Retrieves the first element matching the given CSS selector. If no such element exists, an error is raised.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element
	 *
	 * @property {function(selector:string):PromisedWebDriver -> Element} elementByCssSelectorIfExists
	 * Retrieves the first element matching the given CSS selector, or `undefined` if no such element exists.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element
	 *
	 * @property {function(selector:string, timeout:number):PromisedWebDriver} waitForVisibleByCssSelector
	 * Waits until the first element matching the given CSS selector becomes visible. If the element does not become
	 * visible before the timeout (in milliseconds), an error is raised.
	 *
	 * @property {function(selector:string):PromisedWebDriver -> Array.<Element>} elementsByCssSelector
	 * Retrieves all elements matching the given CSS selector.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/elements
	 *
	 * @property {function(id:string):PromisedWebDriver -> Element} elementById
	 * Retrieves the first element matching the given ID. If no such element exists, an error is raised.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element
	 *
	 * @property {function(id:string):PromisedWebDriver -> Element} elementByIdIfExists
	 * Retrieves the first element matching the given ID, or `undefined` if no such element exists.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element
	 *
	 * @property {function(id:string, timeout:number):PromisedWebDriver} waitForVisibleById
	 * Waits until the first element matching the given ID becomes visible. If the element does not become
	 * visible before the timeout (in milliseconds), an error is raised.
	 *
	 * @property {function(id:string):PromisedWebDriver -> Array.<Element>} elementsById
	 * Retrieves all elements matching the given ID.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/elements
	 *
	 * @property {function(name:string):PromisedWebDriver -> Element} elementByName
	 * Retrieves the first element matching the given HTML name attribute. If no such element exists, an error is
	 * raised.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element
	 *
	 * @property {function(name:string):PromisedWebDriver -> Element} elementByNameIfExists
	 * Retrieves the first element matching the given HTML name attribute, or `undefined` if no such element exists.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element
	 *
	 * @property {function(name:string, timeout:number):PromisedWebDriver} waitForVisibleByName
	 * Waits until the first element matching the given HTML name attribute becomes visible. If the element does not
	 * become visible before the timeout (in milliseconds), an error is raised.
	 *
	 * @property {function(name:string):PromisedWebDriver -> Array.<Element>} elementsByName
	 * Retrieves all elements matching the given HTML name attribute.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/elements
	 *
	 * @property {function(linkText:string):PromisedWebDriver -> Element} elementByLinkText
	 * Retrieves the first link element (`<a>`) whose text contents exactly match the given text. If no such element
	 * exists, an error is raised.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element
	 *
	 * @property {function(linkText:string):PromisedWebDriver -> Element} elementByLinkTextIfExists
	 * Retrieves the first link element (`<a>`) whose text contents exactly match the given text, or `undefined` if no
	 * such element exists.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element
	 *
	 * @property {function(linkText:string, timeout:number):PromisedWebDriver} waitForVisibleByLinkText
	 * Waits until the first link element (`<a>`) whose text contents exactly match the given text becomes visible. If
	 * the element does not become visible before the timeout (in milliseconds), an error is raised.
	 *
	 * @property {function(linkText:string):PromisedWebDriver -> Array.<Element>} elementsByLinkText
	 * Retrieves all link elements (`<a>`) whose text contents exactly match the given text.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/elements
	 *
	 * @property {function(linkText:string):PromisedWebDriver -> Element} elementByPartialLinkText
	 * Retrieves the first link element (`<a>`) whose text contents contain the given text. If no such element
	 * exists, an error is raised.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element
	 *
	 * @property {function(linkText:string):PromisedWebDriver -> Element} elementByPartialLinkTextIfExists
	 * Retrieves the first link element (`<a>`) whose text contents contain the given text, or `undefined` if no
	 * such element exists.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element
	 *
	 * @property {function(linkText:string, timeout:number):PromisedWebDriver} waitForVisibleByPartialLinkText
	 * Waits until the first link element (`<a>`) whose text contents contain the given text becomes visible. If the
	 * element does not become visible before the timeout (in milliseconds), an error is raised.
	 *
	 * @property {function(linkText:string):PromisedWebDriver -> Array.<Element>} elementsByPartialLinkText
	 * Retrieves all link elements (`<a>`) whose text contents contain the given text.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/elements
	 *
	 * @property {function(tagName:string):PromisedWebDriver -> Element} elementByTagName
	 * Retrieves the first element with the given tag name. If no such element exists, an error is raised.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element
	 *
	 * @property {function(tagName:string):PromisedWebDriver -> Element} elementByTagNameIfExists
	 * Retrieves the first element with the given tag name, or `undefined` if no such element exists.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element
	 *
	 * @property {function(tagName:string, timeout:number):PromisedWebDriver} waitForVisibleByTagName
	 * Waits until the first element matching the given tag name becomes visible. If the element does not become
	 * visible before the timeout (in milliseconds), an error is raised.
	 *
	 * @property {function(tagName:string):PromisedWebDriver -> Array.<Element>} elementsByTagName
	 * Retrieves all elements with the given tag name.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/elements
	 *
	 * @property {function(selector:string):PromisedWebDriver -> Element} elementByXPath
	 * Retrieves the first element matching the given XPath selector. If no such element exists, an error is raised.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element
	 *
	 * @property {function(selector:string):PromisedWebDriver -> Element} elementByXPathIfExists
	 * Retrieves the first element matching the given XPath selector, or `undefined` if no such element exists.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element
	 *
	 * @property {function(selector:string, timeout:number):PromisedWebDriver} waitForVisibleByXPath
	 * Waits until the first element matching the given XPath selector becomes visible. If the element does not become
	 * visible before the timeout (in milliseconds), an error is raised.
	 *
	 * @property {function(selector:string):PromisedWebDriver -> Array.<Element>} elementsByXPath
	 * Retrieves all elements matching the given XPath selector.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/elements
	 *
	 * @property {function(element:Element=):PromisedWebDriver -> string} getTagName
	 * Retrieves the tag name of the given element. If no element is provided explicitly, the last stored context
	 * element will be used.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/element/:id/name
	 *
	 * @property {function(element:Element=, name:string):PromisedWebDriver -> ?string} getAttribute
	 * Retrieves the value of the given attribute. If no element is provided explicitly, the last stored context
	 * element will be used.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/element/:id/attribute/:name
	 *
	 * @property {function(element:Element=):PromisedWebDriver -> boolean} isDisplayed
	 * Determines if an element is currently being displayed. If no element is provided explicitly, the last stored
	 * context element will be used.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/element/:id/displayed
	 *
	 * @property {function(element:Element=):PromisedWebDriver -> boolean} isEnabled
	 * Determines if an element is currently enabled. If no element is provided explicitly, the last stored context
	 * element will be used.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/element/:id/enabled
	 *
	 * @property {function(element:Element=):PromisedWebDriver} clickElement
	 * Moves the pointer to an element and clicks on it. If no element is provided explicitly, the last stored context
	 * element will be used.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element/:id/click
	 *
	 * @property {function(element:Element=, ):PromisedWebDriver} click
	 * Moves the pointer to an element and clicks on it. If no element is provided explicitly, the last stored context
	 * element will be used.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element/:id/click
	 *
	 * @property {function(element:Element=, propertyName:string):PromisedWebDriver -> string} getComputedCss
	 * Retrieves the value of the CSS property given in `propertyName`. Note that `propertyName` should be specified
	 * using the CSS-style property name, not the JavaScript-style property name (e.g. `background-color` instead of
	 * `backgroundColor`). If no element is provided explicitly, the last stored context element will be used.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/element/:id/css/:propertyName
	 *
	 * @property {function(element:Element=, otherElement:Element):PromisedWebDriver -> boolean} equalsElement
	 * Determines whether or not the two elements refer to the same DOM node. If no element is provided explicitly,
	 * the last stored context element will be used.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/element/:id/equals/:other
	 *
	 * @property {function(element:Element=, otherElement:Element):PromisedWebDriver -> boolean} equals
	 * Determines whether or not the two elements refer to the same DOM node. If no element is provided explicitly,
	 * the last stored context element will be used.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/element/:id/equals/:other
	 *
	 * @property {function(xspeed:number, yspeed:number):PromisedWebDriver} flick
	 * Performs a touch flick gesture at the given initial speed in pixels per second.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#session/:sessionId/touch/flick
	 *
	 * @property {function(element:Element=, xoffset:number, yoffset:number, speed:number):PromisedWebDriver} flick
	 * Performs a touch flick gesture starting at the given element and moving to the point at `xoffset,yoffset`
	 * relative to the centre of the given element at `speed` pixels per second. If no element is provided explicitly,
	 * the last stored context element will be used.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#session/:sessionId/touch/flick
	 *
	 * @property {function(element:Element=, xoffset:number=, yoffset:number=):PromisedWebDriver} moveTo
	 * Moves the pointer to the centre of the given element. If `xoffset` and `yoffset` are provided, move to that
	 * point relative to the top-left corner of the given element instead. If no element is provided explicitly,
	 * the last stored context element will be used.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/moveto
	 *
	 * @property {function(button:number=):PromisedWebDriver} buttonDown
	 * Press and hold a pointer button (i.e. mouse button). This method uses magic numbers for the button argument:
	 *
	 * * 0 corresponds to left button
	 * * 1 corresponds to middle button
	 * * 2 corresponds to right button
	 *
	 * If a button is not specified, it defaults to the left button.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/buttondown
	 *
	 * @property {function(button:number=):PromisedWebDriver} buttonUp
	 * Release a held pointer button (i.e. mouse button). This method uses magic numbers for the button argument:
	 *
	 * * 0 corresponds to left button
	 * * 1 corresponds to middle button
	 * * 2 corresponds to right button
	 *
	 * If a button is not specified, it defaults to the left button.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/buttonup
	 *
	 * @property {function():PromisedWebDriver} doubleclick
	 * Performs a double-click at the pointer's current position.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/doubleclick
	 *
	 * @property {function(element:Element=, keys:string):PromisedWebDriver} type
	 * Send a series of keystrokes to the given element. Non-text keys can be typed by using special Unicode PUA
	 * values; see the protocol documentation for more information. When using `type`, the entire operation is atomic,
	 * and any modifier keys set by the command string are implicitly released. If no element is provided explicitly,
	 * the last stored context element will be used.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element/:id/value
	 *
	 * @property {function(keys:string):PromisedWebDriver} keys
	 * Send a series of keystrokes to the browser. Non-text keys can be typed by using special Unicode PUA values;
	 * see the protocol documentation for more information. When using `keys`, modifier keys set and not released
	 * will persist beyond the end of the command to enable testing of e.g. mouse actions while holding down modifier
	 * keys.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/keys
	 *
	 * @property {function(element:Element=):PromisedWebDriver} submit
	 * Submits the given form element. If no element is provided explicitly, the last stored context element will be
	 * used.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element/:id/submit
	 *
	 * @property {function(element:Element=):PromisedWebDriver} clear
	 * Clears the content of a given `<textarea>` or `<input type="text">` element. If no element is provided
	 * explicitly, the last stored context element will be used.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element/:id/clear
	 *
	 * @property {function():PromisedWebDriver -> string} title
	 * Retrieves the current title of the page.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/title
	 *
	 * @property {function():PromisedWebDriver -> string} source
	 * Retrieves the HTML source for the currently loaded page.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/source
	 *
	 * @property {function(element:Element=):PromisedWebDriver -> string} text
	 * Retrieves the currently visible text within the element. If no element is provided explicitly, the last stored
	 * context element will be used.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/element/:id/text
	 *
	 * @property {function():PromisedWebDriver -> string} alertText
	 * Retrieves the text of the currently displayed JavaScript alert, confirm, or prompt dialog. If no dialog exists
	 * at the time this method is called, an error is raised.
	 * Note that `alertText` may not be supported by all Selenium drivers.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/alert_text
	 *
	 * @property {function(element:Element=, keys:string):PromisedWebDriver} alertKeys
	 * Send a series of keystrokes to an open prompt dialog. If no dialog exists at the time this method is called,
	 * an error is raised. See {@link keys} for information on valid keys arguments.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/alert_text
	 *
	 * @property {function():PromisedWebDriver} acceptAlert
	 * Accepts the currently displayed dialog. Usually equivalent to clicking the 'OK' button. If no dialog exists
	 * at the time this method is called, an error is raised.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/accept_alert
	 *
	 * @property {function():PromisedWebDriver} dismissAlert
	 * Dismisses the currently displayed dialog. Equivalent to clicking the 'Cancel' button on confirm and prompt
	 * dialogs, and the 'OK' button on alert dialogs. If no dialog exists at the time this method is called, an error
	 * is raised.
	 *
	 * @property {function():PromisedWebDriver -> Element} active
	 * Retrieves the currently focused element.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/element/active
	 *
	 * @property {function():PromisedWebDriver -> string} url
	 * Retrieves the current browser URL.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/url
	 *
	 * @property {function():PromisedWebDriver -> Array.<{ name:string, value:string, =path:string, =domain:string, =secure:string, =expiry:string }>} allCookies
	 * Retrieves all cookies set on the current page.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/cookie
	 *
	 * @property {function(cookie:{ name:string, value:string, =path:string, =domain:string, =secure:string, =expiry:string }):PromisedWebDriver} setCookie
	 * Sets a cookie for the current page.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/cookie
	 *
	 * @property {function():PromisedWebDriver} deleteAllCookies
	 * Deletes all cookies set on the current page.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#DELETE_/session/:sessionId/cookie
	 *
	 * @property {function(name:string):PromisedWebDriver} deleteCookie
	 * Deletes a cookie with the given name from the current page.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#DELETE_/session/:sessionId/cookie/:name
	 *
	 * @property {function():PromisedWebDriver -> string} getOrientation
	 * Retrieves the current device orientation. One of 'LANDSCAPE', 'PORTRAIT'.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/orientation
	 *
	 * @property {function(orientation:string):PromisedWebDriver} setOrientation
	 * Sets the current device orientation. One of 'LANDSCAPE', 'PORTRAIT'.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/orientation
	 *
	 * @property {function(key:string, value:string):PromisedWebDriver} setLocalStorageKey
	 * Sets an item in local storage.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#POST_/session/:sessionId/local_storage
	 *
	 * @property {function(key:string):PromisedWebDriver -> string} getLocalStorageKey
	 * Retrieves an item from local storage.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/local_storage/key/:key
	 *
	 * @property {function(key:string):PromisedWebDriver} removeLocalStorageKey
	 * Removes an item from local storage.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#DELETE_/session/:sessionId/local_storage/key/:key
	 *
	 * @property {function():PromisedWebDriver} clearLocalStorage
	 * Removes all data from local storage for the current page.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#DELETE_/session/:sessionId/local_storage
	 *
	 * @property {function(element:Element=):PromisedWebDriver -> { x:number, y:number }} getLocation
	 * Gets the position of an element on the page. If no element is provided explicitly, the last stored context
	 * element will be used.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/element/:id/location
	 *
	 * @property {function(element:Element=):PromisedWebDriver -> { width:number, height:number }} getSize
	 * Gets the dimensions of an element on the page. If no element is provided explicitly, the last stored context
	 * element will be used.
	 * http://code.google.com/p/selenium/wiki/JsonWireProtocol#GET_/session/:sessionId/element/:id/size
	 *
	 * @property {function():PromisedWebDriver} end
	 * Removes the last element from the stack of stored context elements, just like jQuery's `end` method.
	 * For example:
	 *
	 * <pre>
	 * remote.elementById('foo')
	 *     .elementById('bar')
	 *         // this will click on the element `bar`
	 *         .click()
	 *         // this will stop future methods from interacting on `bar`
	 *         .end()
	 *     // this will click on the element `foo`
	 *     .click()
	 *     // this will stop future methods from interacting on `foo`
	 *     .end();
	 * </pre>
	 *
	 * @property {function(milliseconds:number)} wait
	 * Waits for the given period of time, in milliseconds, before executing the next command.
	 *
	 * @property {function(function(value), function(error:Error)):PromisedWebDriver} then
	 * Standard Promises/A `then` callback registration method. Call this immediately after a method that normally
	 * returns a value to retrieve and interact with the value returned by that call. For example:
	 *
	 * <pre>
	 * remote.elementById('foo')
	 *     .text()
	 *     .then(function (text) {
	 *         // `text` contains the text from the element `foo`
	 *     });
	 * </pre>
	 *
	 * For more information on promises, please see http://dojotoolkit.org/documentation/tutorials/1.9/promises/.
	 *
	 * Note that as of Intern 1.1, attempting to add new commands to the current remote instance from within a `then`
	 * callback will result in a deadlock. This will be addressed in a future version of Intern.
	 *
	 * @property {function(function(error:Error)):PromisedWebDriver} otherwise
	 * Convenience function equivalent to calling `remote.then(null, callback)`.
	 *
	 * @property {function(function(=error:Error)):PromisedWebDriver} always
	 * Convenience function equivalent to calling `remote.then(callback, callback)`.
	 *
	 * @property {function()} cancel
	 * Cancels all outstanding remote requests and rejects the current promise chain.
	 *
	 * @property {function(code:string, timeout:number, =pollFrequency:number):PromisedWebDriver} waitForCondition
	 * Polls the remote browser using `eval` until the code provided in `code` returns a truthy value. If the code does
	 * not evaluate positively within `timeout` milliseconds (default: 1000), an error is raised. An optional
	 * frequency for polling may also be provided (default: 100).
	 *
	 * `waitForConditionInBrowser` should be preferred as long as all browsers under test support the `executeAsync`
	 * method.
	 *
	 * @property {function(code:string, timeout:number, =pollFrequency:number):PromisedWebDriver} waitForConditionInBrowser
	 * Tells the remote browser to poll using `executeAsync` until the code provided in `code` returns a truthy value.
	 * If the code does not evaluate positively within `timeout` milliseconds (default: 1000), an error is raised. An
	 * optional frequency for polling may also be provided (default: 100).
	 *
	 * Note that `executeAsync` may not be supported by all Selenium drivers, in which case `waitForCondition` should
	 * be used instead.
	 *
	 * @property haltChain
	 * Do not use this method. It is not relevant to PromisedWebDriver.
	 * @property pauseChain
	 * Do not use this method. It is not relevant to PromisedWebDriver.
	 * @property chain
	 * Do not use this method. It is not relevant to PromisedWebDriver.
	 * @property next
	 * Do not use this method. It is not relevant to PromisedWebDriver.
	 * @property queueAdd
	 * Do not use this method. It is not relevant to PromisedWebDriver.
	 * @property safeEval
	 * Do not use this method. Use `eval` instead.
	 * @property safeExecute
	 * Do not use this method. Use `execute` instead.
	 * @property safeExecuteAsync
	 * Do not use this method. Use `executeAsync` instead.
	 * @property windowSize
	 * Do not use this method. Use `setWindowSize` instead.
	 * @property altSessionCapabilities
	 * Do not use this method. Use `sessionCapabilities` instead.
	 * @property setHTTPInactivityTimeout
	 * Do not use this method. It is not documented. (It is a timeout for the underlying HTTP request code.)
	 * @property setWaitTimeout
	 * Do not use this method. Use `setImplicitWaitTimeout` instead.
	 * @property element
	 * Do not use this method. Use the more specific `elementBy*` methods instead.
	 * @property elementOrNull
	 * Do not use this method. Use the more specific `elementBy*IfExists` methods instead.
	 * @property elementIfExists
	 * Do not use this method. Use the more specific `elementBy*IfExists` methods instead.
	 * @property elements
	 * Do not use this method. Use the more specific `elementsBy*` methods instead.
	 * @property hasElement
	 * Do not use this method. Use the `elementBy*IfExists` methods instead.
	 * @property waitForElement
	 * Do not use this method. Set `setImplicitWaitTimeout` and use the `elementBy*` methods instead.
	 * @property waitForVisible
	 * Do not use this method. Use the more specific `waitForVisibleBy*` methods instead.
	 * @property *OrNull
	 * Do not use these methods. Use `elementBy*IfExists` instead.
	 * @property hasElement*
	 * Do not use these methods. Set `setImplicitWaitTimeout` and use the `elementBy*` methods instead.
	 * @property waitForElement*
	 * Do not use these methods. Set `setImplicitWaitTimeout` and use the `elementBy*` methods instead.
	 * @property *ByCss
	 * Do not use these methods. Use the `*ByCssSelector` methods instead.
	 * @property displayed
	 * Do not use this method. Use `isDisplayed` instead.
	 * @property enabled
	 * Do not use this method. Use `isEnabled` instead.
	 * @property getValue
	 * Do not use this method. Use `getAttribute('value')` instead.
	 * @property getComputedCSS
	 * Do not use this method. Use `getComputedCss` instead.
	 * @property textPresent
	 * Do not use this method. Use `text` instead.
	 * @property isVisible
	 * Do not use this method. Use `isDisplayed` instead.
	 * @property getPageIndex
	 * Do not use this method. It is not documented.
	 */
	function PromisedWebDriver(config, desiredEnvironment) {
		this._wd = wd.remote(config);
		this._desiredEnvironment = desiredEnvironment;
		this._context = [];
	}

	// WebDriver.prototype exposes all method names, including element methods, except for the 'equals' element
	// method
	// TODO: Do not expose methods that are marked as "Do not use" in the documentation above, then remove the
	// documentation.
	Object.keys(WebDriver.prototype).concat([ 'equals' ]).forEach(function (key) {
		// The original object is indirectly extended by adapting individual methods in order to ensure that any
		// calls by the original WebDriver object to its own methods are not broken by an unexpectedly different
		// interface
		var wrappedFunction = util.adapt(WebDriver.prototype[key], '_wd');

		// Upgrade init so that it can be called with no arguments and use desired environment data provided by
		// the constructor
		if (key === 'init') {
			wrappedFunction = (function (wrappedFunction) {
				return function (desiredEnvironment) {
					return wrappedFunction.call(this, desiredEnvironment || this._desiredEnvironment);
				};
			})(wrappedFunction);
		}

		// Always retrieve code coverage data before navigating to a new URL
		else if (key === 'get' || key === 'quit') {
			wrappedFunction = (function (wrappedFunction) {
				return function () {
					var self = this,
						args = Array.prototype.slice.call(arguments, 0);

					// If someone uses require.toUrl with a functional test, the path will be an absolute filesystem
					// path to the file, but it needs to be a URL to the proxy to work on the remote system
					if (key === 'get' && !/^https?:/.test(args[0])) {
						// oh also by the way baseUrl might not be normalized ha ha ha ha.
						args[0] = this.proxyUrl + args[0].slice(pathUtils.normalize(global.require.baseUrl).length);
					}

					var dfd = new Deferred();

					// Since we are in the middle of a chained call, we must do a low-level call to the wd object;
					// if we try to just call PromisedWebDriver methods directly, the chain will be stalled permanently
					// waiting for the `get` call to complete because the PWD methods cannot run until `get` completes
					// but `get` will not be able to complete without the subsequent PWD methods
					this._wd.execute('return typeof __internCoverage !== "undefined" && JSON.stringify(__internCoverage)', function (error, returnValue) {
						if (error) {
							dfd.reject(error);
							return;
						}

						// returnValue might be falsy on a page with no coverage data, so don't try to publish coverage
						// results to prevent things from breaking
						returnValue && topic.publish('/coverage', self.sessionId, JSON.parse(returnValue));

						wrappedFunction.apply(self, args).then(dfd.resolve.bind(dfd), dfd.reject.bind(dfd));
					});

					return dfd.promise;
				};
			})(wrappedFunction);
		}

		// Allow real functions to be passed directly to execute
		else if (key === 'execute' || key === 'safeExecute') {
			wrappedFunction = (function (wrappedFunction) {
				return function () {
					var args = Array.prototype.slice.call(arguments, 0);

					if (typeof args[0] === 'function') {
						args[0] = 'return (' + args[0] + ').apply(this, arguments);';
					}

					return wrappedFunction.apply(this, args);
				};
			})(wrappedFunction);
		}

		if (/* not a private interface */ key.charAt(0) !== '_') {
			PromisedWebDriver.prototype[key] = function () {
				var self = this,
					args = Array.prototype.slice.call(arguments, 0);

				this._lastPromise = when(this._lastPromise).then(function () {
					// Methods that might interact on elements should be modified to use the current context element
					// as the context object
					if (elementContextMethods[key] && self._context.length) {
						self = self._context[self._context.length - 1];
						wrappedFunction = util.adapt(self[key]);
					}

					// Methods that might accept an element argument should be modified to use the current context
					// element as the argument
					else if (elementArgumentMethods[key] && self._context.length) {
						args.unshift(self._context[self._context.length - 1]);
					}

					return wrappedFunction.apply(self, args);
				});

				this._lastPromise = this._lastPromise.then(function (lastReturnValue) {
					// Methods that get elements need to provide the element as context for the next call to the fluid
					// interface, so users can type e.g. `remote.elementById('foo').clickElement()` and it works as
					// expected.
					if (lastReturnValue instanceof Element) {
						self._context.push(lastReturnValue);
					}
					// We should also check to see if a DOM element is returned from remote execution, e.g. `execute`
					// or `safeExecute`. If this is the case, we should use this element as the context for the next
					//  call to maintain the fluid interface described above.
					else if (lastReturnValue && lastReturnValue.ELEMENT) {
						lastReturnValue = new Element(lastReturnValue.ELEMENT, self._wd);
						self._context.push(lastReturnValue);
					}
					return lastReturnValue;
				});

				return this;
			};
		}
	});

	/**
	 * Ends a context chain.
	 * @param {=number} numContextsToPop The number of element contexts to pop. Defaults to 1.
	 */
	PromisedWebDriver.prototype.end = function (numContextsToPop) {
		var self = this;

		this._lastPromise = when(this._lastPromise).then(function (value) {
			numContextsToPop = numContextsToPop || 1;
			while (numContextsToPop-- && self._context.length) {
				self._context.pop();
			}

			return value;
		});

		return this;
	};

	/**
	 * Waits milliseconds before performing the next command.
	 * @param {number} waitMs Milliseconds to wait.
	 */
	PromisedWebDriver.prototype.wait = function (waitMs) {
		this._lastPromise = when(this._lastPromise).then(function () {
			var dfd = new Deferred();

			setTimeout(function () {
				dfd.resolve();
			}, waitMs);

			return dfd.promise;
		});
		return this;
	};

	PromisedWebDriver.prototype.then = function (callback, errback) {
		var self = this,
			dfd = new Deferred();

		function fixCallback(callback) {
			if (typeof callback !== 'function') {
				return callback;
			}

			return function () {
				self._lastPromise = undefined;

				try {
					var returnValue = callback.apply(this, arguments);

					when(self._lastPromise || returnValue).then(function () {
						dfd.resolve(returnValue);
					}, function (error) {
						dfd.reject(error);
					});
				}
				catch (error) {
					dfd.reject(error);
				}

				return dfd.promise;
			};
		}

		this._lastPromise = this._lastPromise.then(fixCallback(callback), fixCallback(errback));

		return this;
	};

	PromisedWebDriver.prototype.otherwise = function (errback) {
		return this.then(null, errback);
	};

	PromisedWebDriver.prototype.always = function (callback) {
		return this.then(callback, callback);
	};

	/**
	 * Cancels the execution of the remaining chain of commands for this driver.
	 */
	PromisedWebDriver.prototype.cancel = function () {
		this._lastPromise && this._lastPromise.cancel.apply(this._lastPromise, arguments);
		return this;
	};

	/**
	 * Cancels the execution of the remaining chain of commands for this driver and dereferences the old promise chain.
	 */
	PromisedWebDriver.prototype.reset = function () {
		this.cancel();
		this._lastPromise = undefined;
		this._context = [];
		return this;
	};

	/**
	 * Sends a no-op command to the remote server on an interval to prevent.
	 *
	 * @param delay
	 * Amount of time to wait between heartbeats.
	 */
	PromisedWebDriver.prototype.setHeartbeatInterval = function (/**number*/ delay) {
		this._heartbeatIntervalHandle && this._heartbeatIntervalHandle.remove();

		if (delay) {
			// A heartbeat command is sent immediately when the interval is set because it is unknown how long ago
			// the last command was sent and it simplifies the implementation by requiring only one call to
			// `setTimeout`
			var self = this;
			(function sendHeartbeat() {
				var timeoutId,
					cancelled = false,
					startTime = Date.now();

				self._heartbeatIntervalHandle = {
					remove: function () {
						cancelled = true;
						clearTimeout(timeoutId);
					}
				};

				// The underlying `wd` object is accessed directly to bypass pending commands on the promise chain.
				// `url` is used because some more appropriate meta-commands like `status` do not prevent Sauce Labs
				// from timing out
				self._wd.url(function () {
					if (!cancelled) {
						timeoutId = setTimeout(sendHeartbeat, delay - (Date.now() - startTime));
					}
				});
			})();
		}
	};

	/**
	 * This interface provides a mechanism for creating a remote WebDriver instance that uses Promises/A instead of
	 * Node.js callbacks to provide more expressive tests.
	 */
	return {
		/**
		 * Creates a new Promises/A-based remote WebDriver instance.
		 *
		 * @param {{ host: string, port: number, username: ?string, accessKey: ?string }} config
		 * Configuration for connection to the remote WebDriver server. The username and accessKey keys are used
		 * for integration with Sauce Labs.
		 * @returns {PromisedWebDriver}
		 */
		remote: function (config, desiredEnvironment) {
			return new PromisedWebDriver(config, desiredEnvironment);
		}
	};
});
