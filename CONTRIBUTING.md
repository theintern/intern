Contribution guidelines
=======================

## For end-users

* The bug tracker is for bugs, not for questions. If you aren’t sure you are experiencing a bug (or you know you
  aren’t), please [learn where to seek end-user support](https://github.com/theintern/intern/wiki/Support).
  Help questions posted to the bug tracker will be closed.

## For contributors

* Please search the [issue tracker](https://github.com/theintern/intern/issues) before submitting new issues to avoid
  duplicates
* For any non-trivial contributions (new features, etc.), please create a new issue in the issue tracker to track
  discussion prior to submitting a [pull request](http://help.github.com/send-pull-requests)
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
* After committing to master, always checkout `geezer` and `git merge master` if the code applies to both branches
