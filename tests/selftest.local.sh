#!/usr/bin/env bash
set -e
cd "$(dirname $0)/.."
node_modules/.bin/intern-client config=tests/selftest.intern.local reporters=Combined selftest=true selftest2 selftest3=a selftest3=b selftest3=c $@
node_modules/.bin/intern-runner config=tests/selftest.intern.local reporters=Combined selftest=true selftest2 selftest3=a selftest3=b selftest3=c $@
