#!/usr/bin/env bash
cd "$(dirname $0)/.."
node_modules/.bin/intern-client config=tests/intern reporters=leadfoot/tests/combined-reporter $@
node_modules/.bin/intern-runner config=tests/intern reporters=leadfoot/tests/combined-reporter $@
