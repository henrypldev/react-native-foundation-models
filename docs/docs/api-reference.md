---
sidebar_position: 3
---

# API Reference

## LanguageModelSession

### Constructor

Creates a new LanguageModelSession instance. Throws an error if Apple Intelligence is not available.

```typescript
constructor(config?: LanguageModelSessionConfig)
```

**Parameters**:
- `config.instructions?: string` - System instructions defining AI behavior
- `config.tools?: ToolDefinition[]` - Array of tools the AI can invoke
- `config.useCase?: 'general' | 'contentTagging'` - Configures the system model use case
- `config.guardrails?: 'default' | 'permissiveContentTransformations'` - Configures Foundation Models guardrails

### Instance Methods

#### `respond(prompt)`

Generates a complete response from the language model.

```typescript
respond(prompt: string): Promise<string>
```

**Parameters**:
- `prompt: string` - The user's message

#### `streamResponse(prompt, callback)`

Initiates a streaming response from the language model.

```typescript
streamResponse(prompt: string, onChunk: (responseSoFar: string) => void): Promise<string>
```

**Parameters**:
- `prompt: string` - The user's message
- `onChunk: (responseSoFar: string) => void` - Called with the full streamed response so far

#### `tokenCount(prompt)`

Returns the number of tokens the provided text consumes for this session's model.

```typescript
tokenCount(prompt: string): Promise<number>
```

**Parameters**:
- `prompt: string` - The text to measure

**Availability**: iOS 26.4 or later. On earlier versions the returned promise rejects with an `UNSUPPORTED_PLATFORM` error.

### Instance Properties

#### `wasContextReset`

Boolean flag indicating whether the session's context was automatically summarized and reset after reaching the model's context limit. Useful for informing the user that earlier turns may no longer be in context.

```typescript
readonly wasContextReset: boolean
```

## Functions

### `checkFoundationModelsAvailability()`

Check if Apple Intelligence is available on the device.

```typescript
function checkFoundationModelsAvailability(): FoundationModelsAvailability
```

**Returns**: Availability status object with `isAvailable`, `status`, and `message`.

The returned object also includes:
- `contextSize?: number`
- `modelFamily?: '26.0-26.3' | '26.4+'`

### `getFoundationModelsModelFamily()`

```typescript
function getFoundationModelsModelFamily(): '26.0-26.3' | '26.4+' | undefined
```

### `getFoundationModelsContextSize()`

```typescript
function getFoundationModelsContextSize(): number | undefined
```

On iOS 26.4 or later this is bridged directly to the native `SystemLanguageModel.contextSize`. On iOS 26.0 through 26.3 (where the native API is unavailable) it returns `undefined`; Apple documents a 4,096-token context window for that model family.

## Hooks

### `useLanguageModel(config?)`

React hook for managing language model sessions with automatic lifecycle management.

```typescript
function useLanguageModel(config?: UseLanguageModelConfig): UseLanguageModelReturn
```

**Parameters**:
- `config.instructions?: string` - System instructions for the AI
- `config.tools?: ToolDefinition[]` - Tools the AI can use
- `config.onResponse?: (response: string) => void` - Callback for responses
- `config.onError?: (error: AppleAIError) => void` - Callback for errors

**Returns**:
- `session: LanguageModelSession | null` - Current session instance
- `response: string` - Latest response from the AI
- `loading: boolean` - Whether a request is in progress
- `error: AppleAIError | null` - Last error that occurred
- `send: (prompt: string) => Promise<string>` - Function to send messages
- `reset: () => void` - Reset response and error state
- `isSessionReady: boolean` - Whether session is initialized and ready

### `useStreamingResponse(session)`

Lower-level hook for streaming AI responses with more control.

```typescript
function useStreamingResponse(session: LanguageModelSession): UseStreamingResponseReturn
```

**Parameters**:
- `session: LanguageModelSession` - The session to use for streaming

**Returns**:
- `response: string` - Current response text
- `isStreaming: boolean` - Whether currently streaming
- `isComplete: boolean` - Whether streaming is complete
- `error: AppleAIError | null` - Last error that occurred
- `streamResponse: (prompt: string, options?: StreamingOptions) => Promise<string>` - Start streaming
- `cancel: () => void` - Cancel current stream
- `reset: () => void` - Reset state

## Types

### `FoundationModelsAvailability`

```typescript
interface FoundationModelsAvailability {
  isAvailable: boolean;
  status: AvailabilityStatus;
  message: string;
  contextSize?: number;
  modelFamily?: '26.0-26.3' | '26.4+';
}
```

### `AvailabilityStatus`

```typescript
type AvailabilityStatus =
  | 'available'
  | 'unavailable.platformNotSupported'
  | 'unavailable.deviceNotEligible'
  | 'unavailable.appleIntelligenceNotEnabled'
  | 'unavailable.modelNotReady'
  | 'unavailable.unknown'
```

### `LanguageModelSessionConfig`

```typescript
interface LanguageModelSessionConfig {
  instructions?: string;
  tools?: ToolDefinition[];
  useCase?: 'general' | 'contentTagging';
  guardrails?: 'default' | 'permissiveContentTransformations';
}
```

### `ToolDefinition`

```typescript
interface ToolDefinition {
  name: string;
  description: string;
  arguments: AnyMap;
  handler: (args: AnyMap) => Promise<AnyMap>;
}
```

### `AppleAIError`

```typescript
class AppleAIError extends Error {
  readonly code: string;
  readonly details?: Record<string, any>;

  constructor(code: string, message: string, details?: Record<string, any>);
  static fromErrorInfo(errorInfo: AppleAIErrorInfo): AppleAIError;
  toErrorInfo(): AppleAIErrorInfo;
}
```

#### Error Codes

- `SESSION_NOT_INITIALIZED` - Session is not ready
- `TOOL_CALL_ERROR` - Tool call failed
- `TOOL_EXECUTION_ERROR` - Tool execution failed
- `SCHEMA_CREATION_ERROR` - Failed to create tool schema
- `ARGUMENT_PARSING_ERROR` - Failed to parse tool arguments
- `RESPONSE_PARSING_ERROR` - Failed to parse tool response
- `UNKNOWN_TOOL_ERROR` - Unknown tool referenced
- `SESSION_STREAMING_ERROR` - Streaming failed
- `SESSION_RESPONSE_ERROR` - Response failed for a reason with no specific code
- `SESSION_BUSY` - Another request is in progress on this session
- `MODEL_UNAVAILABLE` - Apple Intelligence is not available on this device
- `UNSUPPORTED_PLATFORM` - Platform not supported
- `CONTEXT_EXCEEDED` - The conversation exceeded the context window. The session was recreated with a summary; retry the request
- `CONTEXT_RECOVERY_FAILED` - The context window was exceeded and the session could not be recreated
- `GUARDRAIL_VIOLATION` - The prompt or response violated the model guardrails
- `REFUSAL` - The model refused the request
- `RATE_LIMITED` - The model rate-limited the request
- `ASSETS_UNAVAILABLE` - Model assets are not available
- `DECODING_FAILURE` - The model response could not be decoded
- `UNSUPPORTED_GUIDE` - The request used an unsupported generation guide
- `UNSUPPORTED_LANGUAGE_OR_LOCALE` - The request used an unsupported language or locale
- `UNSUPPORTED_CAPABILITY` - The model does not support a capability the request needs (iOS 27+)
- `UNSUPPORTED_TRANSCRIPT_CONTENT` - The session transcript has content the model does not support (iOS 27+)
- `TIMEOUT` - The request timed out (iOS 27+)
- `TOKEN_COUNT_ERROR` - Token counting failed

The same failure has the same code on iOS 26 and iOS 27.

### `StreamingOptions`

```typescript
interface StreamingOptions {
  onToken?: (token: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: AppleAIError) => void;
}
```

## Utilities

### `createTool(definition)`

Helper function to create type-safe tools with Zod schema validation.

```typescript
function createTool<T extends ZodObjectSchema>(definition: {
  name: string;
  description: string;
  arguments: T;
  handler: (params: z.infer<T>) => Promise<AnyMap>;
}): ToolDefinition
```

The Zod schema you pass is the exact contract the model sees. Supported schema features:

- `z.string()`, `z.number()`, `z.number().int()`, `z.boolean()`
- `z.object()` and `z.array()`, nested to any depth
- `.optional()`, `.nullish()`, and `.default()` — the field becomes optional for the model
- `z.enum([...])` and string `z.literal()`
- Inclusive bounds: `.min()` / `.max()` on numbers and arrays
- `.describe()` on any field

Unsupported features fail at `createTool` time with a `SCHEMA_CREATION_ERROR` that names the property and a supported alternative. Rejected: bare `.nullable()` on a required field (the model cannot emit `null`; use `.nullish()`), unions, records, tuples, intersections, non-string enums and literals, regex patterns and string formats (`.email()` and similar), exclusive bounds (`.gt()` / `.lt()`), and `.multipleOf()`.

Tool arguments and results round-trip with full structure: nested objects, arrays, and `null` values are preserved in both directions.

If you construct a `ToolDefinition` by hand instead of using `createTool`, the `arguments` field accepts either a JSON Schema document (as described above) or a legacy flat map of `{ propertyName: "string" | "number" | "integer" | "boolean" }`. Unknown type names in the flat map fail with a `SCHEMA_CREATION_ERROR`.

### `isAppleAIError(error)`

Type guard to check if an error is an AppleAIError.

```typescript
function isAppleAIError(error: any): error is AppleAIError
```

### `parseNativeError(error)`

Parse native errors into AppleAIError instances.

```typescript
function parseNativeError(error: any): AppleAIError
```
