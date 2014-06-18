#!/usr/bin/env bash
set -e
cd "$(dirname $0)/.."
node_modules/.bin/intern-client config=tests/selftest.intern reporters=intern-selftest/tests/combined-reporter selftest=true $@
node_modules/.bin/intern-runner config=tests/selftest.intern reporters=intern-selftest/tests/combined-reporter selftest=true $@
