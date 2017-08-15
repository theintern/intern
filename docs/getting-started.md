# Getting started

<!-- vim-markdown-toc GFM -->
* [Overview](#overview)
* [Installation](#installation)
* [Recommended directory structure](#recommended-directory-structure)
* [Terminology](#terminology)
* [Conventions](#conventions)
	* [Asynchronous operations](#asynchronous-operations)
	* [Module loader](#module-loader)
* [Testing your first app](#testing-your-first-app)

<!-- vim-markdown-toc -->

## Overview

Intern provides two strategies for automated testing: unit testing and functional testing.

Unit testing works by executing a piece of code directly and inspecting the result. For example, calling a function and then checking that it returns an expected value is a form of unit testing. This is the most common and most useful form of testing for day-to-day development, since it’s very fast and allows very small units of code to be tested in isolation. However, unit tests are limited to only testing certain testable code designs, and can also be limited by the constraints of the execution environment (like browser sandboxes).

Functional testing works by issuing commands to a device that mimic actual user interactions. Once an interaction has occurred, these tests verify that the expected information is displayed by the user interface. Because these interactions come from outside the application being tested, they are not restricted by the execution environment. They also allow application code to be treated as a black box, which means functional tests can be written to test pages and applications written in any language. Because functional tests don’t call any APIs directly, code that is unable to be unit tested can still be successfully exercised. Functional tests allow the automation of UI & integration testing that would otherwise need to be performed manually.

By understanding & combining both of these testing strategies when testing an application, it becomes possible to effectively automate nearly all of the QA process, enabling much faster development cycles and significantly reducing software defects.

## Installation

Intern can be installed simply by running npm install intern.

## Recommended directory structure

While Intern can be used to test code using nearly any directory structure, if you are starting a new project or have the ability to modify the directory structure of your existing project, a few small changes can help make Intern integration a lot easier.

The recommended directory structure for a front-end or front+back-end project using Intern looks like this:

```
project_root/
  dist/         – (optional) Built code; mirrors the `src` directory
  node_modules/ – Node.js dependencies, including Intern
	intern/
  src/          – Front-end source code (+ browser dependencies)
	app/        – Your application code
	index.html  – Your application entry point
  tests/        – Intern tests
	functional/ – Functional tests
	support/    – Test support files
				  (custom interfaces, reporters, mocks, etc.)
	unit/       – Unit tests
	intern.js   – Intern configuration
```

Using this directory structure provides a few benefits:

-   It lets you easily switch from testing source and built code simply by changing the location of your packages from src to dist in your Intern configuration
-   It lets you use the default loader `baseUrl` configuration setting without worrying about path differences between Node.js and browser
-   It adds another layer of assurance that your tests and other private server-side code won’t be accidentally deployed along with the rest of your application

## Terminology

Intern uses certain standard terminology in order to make it easier to understand each part of the system.

-   An [assertion](./unit-tests.md) is a function call that verifies that an expression (like a variable or function call) returns an expected, correct, value (e.g. `assert.isTrue(someVariable, 'someVariable should be true')`)
-   A test [interface](./interfaces.md) is a programming interface for registering tests with Intern
-   A test case (or, just test) is a function that makes calls to application code and makes assertions about what it should have done
-   A test suite is a collection of tests (and, optionally, sub–test-suites) that are related to each other in some logical way
-   A test module is a JavaScript module, usually in [AMD format](#module-loader), that contains test suites

These pieces can be visualized in a hierarchy, like this:

-   test module
    -   test suite
        -   test suite
            -   test case
                -   assertion
                -   assertion
                -   …
            -   …
        -   test case
            -   assertion
            -   assertion
            -   …
        -   …
    -   test suite
    -   …
-   test module
-   …

## Conventions

Intern follows certain conventions in order to make testing easier and more reliable. Understanding these fundamental concepts will help you get the most out of testing with Intern.

### Asynchronous operations

Intern always uses [Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) objects whenever an asynchronous operation needs to occur. All [suite](./internals#the-suite-object), [test](https://theintern.github.io/intern/#test-object), and [reporter](./reporters.md) functions can return a Promise, which will pause the test system until the Promise resolves (or until a timeout occurs, whichever happens first).

### Module loader

Intern is built on top of a standard AMD loader, which means that its modules are also normally written in the AMD module format. Using an AMD loader instead of something like the built-in Node.js loader + Browserify is critical to provide a highly stable and flexible testing system, because AMD is the only stable standard for module loading that has all of these traits:

-   Allows modules to be written for the browser without *requiring* an intermediate compilation step;
-   Allows modules and other assets to be *asynchronously* or *conditionally* resolved by writing simple [loader plugins](https://github.com/amdjs/amdjs-api/blob/master/LoaderPlugins.md);
-   Allows “hard-coded” dependencies of modules under test to be [mocked](https://www.sitepen.com/blog/2014/07/14/mocking-data-with-intern/#mocking-amd-dependencies) without messing with the internals of the module loader

For users that are only familiar with Node.js modules, AMD modules are exactly the same with one extra line of wrapper code to enable asynchronous loading:

    define(function (require, exports, module) {
    /* Node.js module code here! */
    });

Because the AMD standard includes the ability to run loader plugins, it’s not necessary for your test modules to be written as AMD modules if you don’t want. Just write a loader plugin that understands the module format you prefer and you’re ready to go!

Once the [outstanding issues with native ES modules](http://jrburke.com/2015/02/13/how-to-know-when-es-modules-are-done/) have been addressed, and a native module loader with equivalent capabilities to a standard AMD loader is available on all the [platforms supported by Intern](./fundamentals.md#system-requirements), Intern will be updated to use the native ES module format.

## Testing your first app

In order to quickly get started with Intern, we’ve created a basic [tutorial](https://github.com/theintern/intern-tutorial) that walks through the steps required to install, configure, and run basic tests against a very simple demo application.

Once you’ve run through the tutorial, you may also want to look at some of the [example integrations](https://github.com/theintern/intern-examples) for popular libraries and frameworks if you are using AngularJS, Backbone.js, Dojo, Ember, or jQuery.

Some of the example integrations are outdated and don’t represent modern best practices when using Intern. We’d love it if you’d [submit your own examples](https://github.com/theintern/intern-examples/fork) following the patterns outlined in this document to make Intern easier to use for new users!

After that, continue reading the user guide to learn about all the advanced functionality available within Intern that you can use test your own code better and faster!
