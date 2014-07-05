# “We need to support old IE. Make the Intern we really, really hate do the testing” [![Build Status](https://travis-ci.org/theintern/intern.png?branch=geezer)](https://travis-ci.org/theintern/intern)

Intern is a complete test stack for JavaScript designed to help you write and run consistent, high-quality test
cases for your JavaScript libraries and applications. It can be used to test *any* JavaScript code. Its functional
testing capabilities can even be used to test non-JavaScript Web and mobile apps, if you really want.

Learn more about Intern at http://theintern.io.

## This branch

The `geezer` branch provides support for testing ancient browsers that do not support EcmaScript 5 (IE 6–8). It does
*not* use the Chai library, as Chai also requires ES5. Instead, there is an assertion library at `intern/assert`
that is API-compatible with Chai’s `assert`-style API. This module is not covered under the Dojo Foundation CLA
governing the rest of the Intern project.

This branch will only be maintained for as long as absolutely necessary since it is ugly and a burden.

## Quick start

1. Install from npm

   ```
   cd /my/project/root
   npm install intern-geezer --save-dev
   ```

2. Create a copy of the [example configuration file](https://github.com/theintern/intern/blob/geezer/tests/example.intern.js) in your package’s test directory and edit appropriately. See the
[configuration documentation](https://github.com/theintern/intern/wiki/Configuring-Intern) for a list of all available
options.

   ```
   mkdir tests ; cp node_modules/intern-geezer/tests/example.intern.js tests/intern.js
   ```

3. Verify your configuration works by running the Node.js client and seeing that no errors are output.

   ```
   node_modules/.bin/intern-client config=tests/intern
   ```

4. Start writing tests! See the [writing tests](https://github.com/theintern/intern/wiki/Writing-Tests-With-Intern) documentation
and the [Intern tutorial](https://github.com/theintern/intern-tutorial) to learn how.

## More information

* [Web site](http://theintern.io)
* [Documentation](https://github.com/theintern/intern/wiki)
* [Support](https://github.com/theintern/intern/wiki/Support)

## License

Intern is available under the terms of the [New BSD License](LICENSE). All code, with the exception of
portions of the `assert.js` library and tests in the geezer branch, is developed under the terms of the
[Dojo Foundation CLA](http://dojofoundation.org/about/cla).

© 2012–2013 Colin Snover http://zetafleet.com<br>
© 2013–2014 SitePen, Inc. http://sitepen.com
