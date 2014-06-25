#!/usr/bin/env bash
cd "$(dirname $0)/.."
node_modules/intern/bin/intern-client.js config=tests/selftest.intern reporters=intern-selftest/lib/reporters/combined selftest=true selftest2 selftest3=a selftest3=b selftest3=c $@
node_modules/intern/bin/intern-runner.js config=tests/selftest.intern reporters=intern-selftest/lib/reporters/combined selftest=true selftest2 selftest3=a selftest3=b selftest3=c $@
