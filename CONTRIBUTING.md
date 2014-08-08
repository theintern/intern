Contribution guidelines
=======================

## For people that are using Intern

* Sorry, the bug tracker is for bugs and feature enhancement requests only, not questions. If you aren’t sure if your
  problem is a bug (or you know that it isn’t), please ask in one of the
  [support areas](https://github.com/theintern/intern/wiki/Support) instead. Any help questions posted to the bug
  tracker will normally be closed without a response in order to keep the bug tracker focused only on the development
  process.
* General guidelines for choosing the appropriate issue tracker for your problem:
  * [Dig Dug](https://github.com/theintern/digdug/issues) should be used for issues regarding downloading or starting
    service tunnels, or interacting with a service provider’s REST API
  * [Leadfoot](https://github.com/theintern/leadfoot/issues) should be used for issues with any of the functional
    testing APIs, including issues with cross-browser inconsistencies or unsupported Selenium environments
  * [Intern](https://github.com/theintern/intern/issues) for all other issues

## For people that want to submit a new feature or bug fix

* If you want to help, but aren’t sure where to start, come [talk to us on IRC](irc://irc.freenode.net/intern) or ask
  in a ticket about where you’d start. You should also talk to us if you are working on a big thing so we can coordinate
  before you spend a lot of time on it
* Please search the issue tracker before submitting new issues to avoid duplicates, and to make sure someone else is not
  already working on your thing
* You must have a signed [Dojo Foundation CLA](http://dojofoundation.org/about/claForm) for any non-trivial patches to
  be accepted
* Any submitted code should conform to the project’s
  [code style guidelines](https://github.com/csnover/dojo2-core#code-conventions)
* If appropriate, a test case should be part of the pull request
* Thank you for your contribution!

## For committers

* Provide rigorous code review for contributors
* When in doubt, ask for a second review; don’t commit code that smells wrong just because it exists
* Squash all pull requests into a single commit using
  `git pull --squash --no-commit https://github.com/contributor/intern branch-name` and then
  `git commit --author="Author Name <email@example>"`. Don’t use the shiny green button!
* Put `[ci skip]` at the end of commit messages for commits that do not modify any code (readme changes, etc.)
* (Intern only) After committing to master, always checkout `geezer` and `git merge master` if the code applies to both
  branches
