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
  ios/FoundationModelsErrorMapping.swift \
  tests/FoundationModelsErrorMappingTests.swift \
  -o /tmp/rn-foundation-models-error-mapping-tests
/tmp/rn-foundation-models-error-mapping-tests
