Contribution guidelines
=======================

## For contributors

* Search the [issue tracker](https://github.com/theintern/intern/issues) before submitting new issues to avoid
  duplicates
* For any non-trivial contributions (new features, etc.), please create a new issue for discussion prior to submitting
  a [pull request](http://help.github.com/send-pull-requests)
* You must have a signed [Dojo Foundation CLA](http://dojofoundation.org/about/claForm)
* Your pull request must conform to the project’s
  [JavaScript Style Guidelines](https://github.com/csnover/dojo2-core#code-conventions)
* If appropriate, a test case should be part of the pull request

## For committers

* Squash all pull requests into a single commit using
  `git pull --squash --no-commit https://github.com/contributor/intern branch-name` and then
  `git commit --author="Author Name <email@example>"`. Don’t use the shiny green button!
* Put `[ci skip]` at the end of commit messages for commits that do not modify any code (readme changes, etc.)
* After committing to master, always checkout `geezer` and `git merge master`