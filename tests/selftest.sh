#!/usr/bin/env bash
cd "$(dirname $0)/.."
node_modules/.bin/intern-client config=tests/selftest.intern reporters=intern-selftest/lib/reporters/combined selftest=true selftest2 selftest3=a selftest3=b selftest3=c $@
node_modules/.bin/intern-runner config=tests/selftest.intern reporters=intern-selftest/lib/reporters/combined selftest=true selftest2 selftest3=a selftest3=b selftest3=c $@
