#!/bin/bash

set -e

cd $(dirname "$0")

for image in $(echo "$SUPPORTED_MONGO_VERSIONS" | tr ',' ' '); do
    MONGO_IMAGE_TAG_DNS=$(echo $image | tr '.' '-')
    MONGO_CONNECT_STRING="mongodb://mongo-svc-${MONGO_IMAGE_TAG_DNS}.pltn-relaxation-test-${PELTON_ISOLATION}:27017"

    if [[ -n "$RUN_TESTS" ]]; then
        export RUN_TESTS="$RUN_TESTS;"
    fi

    EXTRA_ARGS=$(echo "$PELTON_EXTRA_ARGS" | jq '.[]' | tr '\n' ' ' | sed 's|"|\\"|g')

    export RUN_TESTS="$RUN_TESTS env MONGO_CONNECT_STRING=$MONGO_CONNECT_STRING npx ava $EXTRA_ARGS"
done

export RUN_TESTS="set -x; $RUN_TESTS"

cat test-runner.Dockerfile | envsubst