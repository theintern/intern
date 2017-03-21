#!/usr/bin/env bash
set -e
cd "$(dirname $0)/.."
node_modules/.bin/intern-client config=tests/selftest.intern reporters=Combined selftest=true selftest2 selftest3=a selftest3=b selftest3=c $@
if [[ $INTERN_NODE_ONLY != "1" ]]; then
	node_modules/.bin/intern-runner config=tests/selftest.intern reporters=Combined selftest=true selftest2 selftest3=a selftest3=b selftest3=c $@
fi
