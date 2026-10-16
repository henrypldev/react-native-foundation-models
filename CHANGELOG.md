# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `LanguageModelSession` for interacting with Apple's on-device Foundation Models.
- `useLanguageModel` and `useStreamingResponse` React hooks.
- Tool calling support via Zod schemas (`createTool`).
- `checkFoundationModelsAvailability` and `getFoundationModelsModelFamily` helpers.
- `getFoundationModelsContextSize` to read the model's context window size in
  tokens (requires iOS 26.4+); also surfaced via `checkFoundationModelsAvailability`.
- `SystemLanguageModel` configuration (`useCase`, `guardrails`).
- Native `tokenCount` method on `LanguageModelSession`.
- Per-request `GenerationOptions` on `respond`, `streamResponse`, and the hooks:
  `temperature`, `maximumResponseTokens`, `samplingMode`, and on iOS 27
  `toolCallingMode` and `reasoningLevel`.
- Structured output: pass a Zod object schema as `schema` to `respond` or
  `streamResponse`.
- `session.transcript`, `new LanguageModelSession({ transcript })`, and
  `session.prewarm()`.
- `session.usage` and `session.lastResponseUsage` (iOS 27).
- `variant` and `capabilities` in `checkFoundationModelsAvailability` (iOS 27).
- iOS 27 generation errors map to the same stable codes as iOS 26. New codes:
  `UNSUPPORTED_CAPABILITY`, `UNSUPPORTED_TRANSCRIPT_CONTENT`, `TIMEOUT`,
  `INVALID_GENERATION_OPTIONS`, `INVALID_SESSION_OPTIONS`, `INVALID_TRANSCRIPT`,
  `TRANSCRIPT_ENCODING_ERROR`, and `PREWARM_ERROR`.

### Changed

- Renamed package from `react-native-apple-intelligence` to `react-native-foundation-models`.
- `streamResponse` callback now emits chunks instead of the full response.
- `LanguageModelSessionOptions` and `UseLanguageModelConfig` are now type aliases
  for a union that allows `instructions` or `transcript`, not both. An
  `interface` that `extends` either type no longer compiles. Use an
  intersection (`type Props = LanguageModelSessionOptions & { ... }`) instead.

### Deprecated

- `modelFamily` and `getFoundationModelsModelFamily`. They guess from the iOS
  version and report `'26.4+'` for every iOS 27 model. Read `variant` instead.

## [0.1.0] - 2025-09-18

### Added

- Response streaming.
- Tool calling.
