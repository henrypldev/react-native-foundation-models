#!/usr/bin/env bash
set -euo pipefail

CACHE=/tmp/rn-foundation-models-module-cache
STAND_INS=tests/support/NitroStandIns.swift

check_stand_in() {
  local generated stand_in
  generated=$(grep -m1 -o 'init([^)]*)' "nitrogen/generated/ios/swift/$1.swift" | grep -oE '[A-Za-z]+:' | tr -d ':')
  stand_in=$(awk "/^struct $1 /,/^}/" "$STAND_INS" | grep -oE 'var [A-Za-z]+' | cut -d' ' -f2)
  if [ "$generated" != "$stand_in" ]; then
    echo "$STAND_INS: $1 fields differ from nitrogen/generated/ios/swift/$1.swift" >&2
    exit 1
  fi
}

run_suite() {
  local binary="/tmp/rn-foundation-models-$1"
  shift
  swiftc -parse-as-library -module-cache-path "$CACHE" \
    ios/AppleAIErrors.swift ios/GenerationFailure.swift ios/FoundationModels27.swift ios/TokenUsage.swift \
    "$STAND_INS" "$@" -o "$binary"
  "$binary"
}

check_compiler_fork() {
  local stray
  stray=$(grep -l '#if compiler' ios/*.swift | grep -v '^ios/FoundationModels27.swift$' || true)
  if [ -n "$stray" ]; then
    echo "Keep #if compiler forks in ios/FoundationModels27.swift, found in: $stray" >&2
    exit 1
  fi
}

check_compiler_fork
check_stand_in NativeGenerationOptions
check_stand_in NativeTokenUsage

run_suite streaming ios/StreamingResponseAccumulator.swift tests/StreamingResponseAccumulatorTests.swift
run_suite schema ios/GenerationSchemaBuilder.swift ios/ToolContent.swift tests/GenerationSchemaBuilderTests.swift
run_suite generation-failure tests/GenerationFailureTests.swift
run_suite generation-options ios/GenerationOptionsMapping.swift tests/GenerationOptionsMappingTests.swift
run_suite transcript ios/TranscriptCoding.swift tests/TranscriptCodingTests.swift
run_suite token-usage tests/TokenUsageTests.swift
