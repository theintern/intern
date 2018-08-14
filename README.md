# intern-common

This repository contains common library code used by Intern projects. It's
essentially a subset of [@dojo/core](https://github.com/dojo/core) and
[@dojo/shim](https://github.com/dojo/shim), extracted to prevent circular
dependencies between Dojo and Intern.

While the implementations of `Task`, `Evented`, and the various utility
functions are very similar (and in some cases the same as) their @dojo
counterparts, there are a few differences. Probably the most significant is with
the `request` module, which uses a simpler API that Dojo's `request` and is
backed by [axios](https://github.com/axios/axios).

## Usage

This package exports its public interface through its base import:

```js
import { Task, Evented, request } from '@theintern/common';
```

## Features

The following concrete exports are provided:

- **Evented:** Base class for event emitters
- **Task:** Cancellable promise
- **global:** Pointer to the global object (e.g., `window`)
- **request:** Simple network request module
- **createHandle:** Create a handle that can be used to cleanup resources
- **createCompositeHandle:** Create an aggregate Handle
- **deepMixin:** Deeply one or more objects into a target object
- **duplicate:** Deep copy an object
- **partial:** Create a function from a base function by binding one or more
  arguments of the base function to given values

## Development

The development flow is standard:

1.  `npm install`
2.  `npm run build` (or `npm run watch`)
3.  `npm test` to run tests

The build process creates four webpack bundles in `_build/`: one is the
distributable `index.js`, two are for unit tests (browser and Node), and one is
for integration tests.
