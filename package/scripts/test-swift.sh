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
    ios/AppleAIErrors.swift "$STAND_INS" "$@" -o "$binary"
  "$binary"
}

check_stand_in NativeGenerationOptions

run_suite streaming ios/StreamingResponseAccumulator.swift tests/StreamingResponseAccumulatorTests.swift
run_suite tool-schema ios/ToolSchemaBuilder.swift tests/ToolSchemaBuilderTests.swift
run_suite generation-failure ios/GenerationFailure.swift tests/GenerationFailureTests.swift
run_suite generation-options ios/GenerationOptionsMapping.swift tests/GenerationOptionsMappingTests.swift
