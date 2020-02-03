# Contribution guidelines

## Hi! Welcome!

Thanks for taking a look at our contribution guidelines. This is a small
open-source project and we’re always looking to get more people actively
involved in its development and direction, even if you can’t send code!

## Reporting bugs & feature requests

For bugs, please
[open a ticket](https://github.com/theintern/intern/issues/new), providing a
description of the problem, reproduction steps, expected result, and actual
result. It’s very hard for us to solve your problem without all of this
information.

For feature requests, open a ticket describing what you’d like to see and we’ll
try to figure out how it can happen! We (and all the other Intern users) would
really appreciate it if you could also pitch in to actually implement the
feature (maybe with some help from us?).

Note that we prefer to keep the issue tracker focused on development tasks. If
you have questions about using Intern or writing tests, please see our
[Help](docs/help.md) doc.

## Getting involved

If you want to get involved with the sexy, sexy world of testing software, but
aren’t sure where to start, come
[talk to us on Gitter](https://gitter.im/theintern/intern) or look through the
[issues](https://github.com/theintern/intern/issues) for something that piques
your interest. The development team is always happy to provide guidance to new
contributors!

If you’re not a coder (or you just don’t want to write code), we can still
really use your help in other areas, like improving documentation, performing
marketing and outreach, or [helping other users](docs/help.md), so get in touch
if you’d be willing to help in any way!

## Submitting pull requests

Like most open source projects, we require everyone to sign a contributor
license agreement before we can accept any pull requests. You’ll be asked to
sign the CLA when you open your first PR.

We ask that any updates use the same style as the existing code. Intern installs
a pre-commit hook that runs our linting and styling tools whenever you commit,
so that _should_ be automatically taken care of. If possible and appropriate,
updated tests should also be a part of your pull request. (If you’re having
trouble writing tests, we can help you with them!)

## Advanced instructions for committers

- Please make sure to provide rigorous code review on new contributions
- When in doubt, ask for a second review; don’t commit code that smells wrong
  just because it exists
- Squash PRs into the fewest number of meaningful commits (often just 1)
- Put `[ci skip]` at the end of commit messages for commits that do not modify
  any code (readme changes, etc.)
