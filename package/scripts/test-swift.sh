#!/usr/bin/env bash
# Compiles and runs the host-side Swift test binaries.
set -euo pipefail

CACHE=/tmp/rn-foundation-models-module-cache

swiftc -module-cache-path "$CACHE" \
  ios/AppleAIErrors.swift \
  ios/StreamingResponseAccumulator.swift \
  tests/StreamingResponseAccumulatorTests.swift \
  -o /tmp/rn-foundation-models-tests
/tmp/rn-foundation-models-tests

swiftc -parse-as-library -module-cache-path "$CACHE" \
  ios/AppleAIErrors.swift \
  ios/ToolSchemaBuilder.swift \
  tests/ToolSchemaBuilderTests.swift \
  -o /tmp/rn-foundation-models-schema-tests
/tmp/rn-foundation-models-schema-tests

swiftc -parse-as-library -module-cache-path "$CACHE" \
  ios/AppleAIErrors.swift \
  ios/GenerationFailure.swift \
  tests/GenerationFailureTests.swift \
  -o /tmp/rn-foundation-models-generation-failure-tests
/tmp/rn-foundation-models-generation-failure-tests
