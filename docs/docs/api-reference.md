---
sidebar_position: 3
---

# API Reference

## LanguageModelSession

### Constructor

Creates a new LanguageModelSession instance. Throws an error if Apple Intelligence is not available.

```typescript
constructor(config?: LanguageModelSessionOptions)
```

**Parameters**:
- `config.instructions?: string` - System instructions defining AI behavior
- `config.transcript?: SerializedTranscript` - A transcript saved from an earlier session with `session.transcript`. The new session continues that conversation and keeps its instructions. Cannot be combined with `instructions`: TypeScript rejects it, and at runtime it throws `INVALID_SESSION_OPTIONS`. A transcript that cannot be read throws `INVALID_TRANSCRIPT`
- `config.tools?: ToolDefinition[]` - Array of tools the AI can invoke
- `config.useCase?: 'general' | 'contentTagging'` - Configures the system model use case
- `config.guardrails?: 'default' | 'permissiveContentTransformations'` - Configures Foundation Models guardrails

### Instance Methods

#### `respond(prompt, options?)`

Generates a complete response from the language model.

```typescript
respond(prompt: string, options?: GenerationOptions): Promise<string>
respond<S extends ObjectSchema>(
  prompt: string,
  options: StructuredGenerationOptions<S>,
): Promise<z.infer<S>>
```

**Parameters**:
- `prompt: string` - The user's message
- `options?: GenerationOptions` - Sampling, temperature, and length limits for this request. See [`GenerationOptions`](#generationoptions)
- `options.schema?: ObjectSchema` - A Zod object schema. When set, the response is constrained to the schema and the promise resolves with the parsed value. See [Structured output](#structured-output)

```typescript
const answer = await session.respond('Name a color', {
  samplingMode: { kind: 'greedy' },
  maximumResponseTokens: 20,
});
```

#### `streamResponse(prompt, callback, options?)`

Initiates a streaming response from the language model.

```typescript
streamResponse(
  prompt: string,
  onChunk: (responseSoFar: string) => void,
  options?: GenerationOptions,
): Promise<string>
streamResponse<S extends ObjectSchema>(
  prompt: string,
  onChunk: (partial: DeepPartial<z.input<S>>) => void,
  options: StructuredGenerationOptions<S>,
): Promise<z.infer<S>>
```

**Parameters**:
- `prompt: string` - The user's message
- `onChunk` - Called with the full streamed response so far. With `options.schema`, called with the partial object generated so far
- `options?: GenerationOptions` - Sampling, temperature, and length limits for this request. See [`GenerationOptions`](#generationoptions)
- `options.schema?: ObjectSchema` - A Zod object schema. See [Structured output](#structured-output)

#### Structured output

```typescript
const Contact = z.object({
  name: z.string(),
  role: z.enum(['engineer', 'designer', 'manager']),
  address: z.object({ city: z.string(), country: z.string() }),
  skills: z.array(z.string()).max(4),
});

const contact = await session.respond(text, { schema: Contact });

const final = await session.streamResponse(text, setDraft, { schema: Contact });
```

- The schema must have `z.object` at the root. It follows the same rules as tool arguments. See [`createTool`](#createtooldefinition). An unsupported schema rejects with `SCHEMA_CREATION_ERROR` before the request reaches the model. Error paths start with `response`, for example `response.address.city`.
- The final value is parsed with the schema, so defaults and transforms apply. If it does not parse, the request rejects with `RESPONSE_VALIDATION_ERROR`. `details.issues` holds the Zod issues and `details.response` holds the raw value. This can happen with checks the model cannot see, such as `.refine()`.
- Each streamed snapshot is the complete object generated so far, as valid JSON. Snapshots are not validated. Fields appear in the order the model writes them, which is not always the schema order. A string can be incomplete. An enum value can be `''` before the model picks one. An array can hold an empty placeholder element (`{}` or `''`) before the model fills it in. Consecutive snapshots can be equal.
- Context overflow and the other generation errors have the same codes as for text responses.
- `useLanguageModel` and `useStreamingResponse` return text only.

#### `tokenCount(prompt)`

Returns the number of tokens the provided text consumes for this session's model.

```typescript
tokenCount(prompt: string): Promise<number>
```

**Parameters**:
- `prompt: string` - The text to measure

**Availability**: iOS 26.4 or later. On earlier versions the returned promise rejects with an `UNSUPPORTED_PLATFORM` error.

#### `prewarm(promptPrefix?)`

Asks the system to load the model resources for this session before the first request, so the first response can start sooner. Call it when a request is likely soon, such as when a chat screen opens.

```typescript
prewarm(promptPrefix?: string): void
```

**Parameters**:
- `promptPrefix?: string` - The expected start of the next prompt, when known

### Instance Properties

#### `wasContextReset`

Boolean flag indicating whether the session's context was automatically summarized and reset after reaching the model's context limit. Useful for informing the user that earlier turns may no longer be in context.

```typescript
readonly wasContextReset: boolean
```

#### `transcript`

The conversation so far, including the instructions. Each read returns the current state. After a context overflow the session is replaced by a summarized one, and `transcript` reads the replacement.

```typescript
readonly transcript: SerializedTranscript
```

```typescript
await storage.set('chat', session.transcript);

const saved = (await storage.get('chat')) as SerializedTranscript;
const restored = new LanguageModelSession({ transcript: saved, tools });
```

Tools are not stored in the transcript. Pass them again to the new session. A transcript that cannot be encoded throws `TRANSCRIPT_ENCODING_ERROR`.

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
- `config.transcript?: SerializedTranscript` - A saved transcript to continue. Cannot be combined with `instructions`
- `config.tools?: ToolDefinition[]` - Tools the AI can use
- `config.onResponse?: (response: string) => void` - Callback for responses
- `config.onError?: (error: AppleAIError) => void` - Callback for errors

**Returns**:
- `session: LanguageModelSession | null` - Current session instance
- `response: string` - Latest response from the AI
- `loading: boolean` - Whether a request is in progress
- `error: AppleAIError | null` - Last error that occurred
- `send: (prompt: string, options?: GenerationOptions) => Promise<string>` - Function to send messages, with optional per-request generation options
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

### `GenerationOptions`

Options for one `respond` or `streamResponse` request. All fields are optional. Invalid values reject the request with an `INVALID_GENERATION_OPTIONS` error before it reaches the model. The error's `details.field` names the invalid field.

```typescript
interface GenerationOptions {
  temperature?: number;
  maximumResponseTokens?: number;
  samplingMode?: SamplingMode;
  toolCallingMode?: ToolCallingMode;
}

type SamplingMode =
  | { kind: 'greedy' }
  | { kind: 'randomTopK'; top: number; seed?: number }
  | { kind: 'randomProbabilityThreshold'; probabilityThreshold: number; seed?: number };

type ToolCallingMode = 'allowed' | 'required' | 'disallowed';
```

- `temperature` - A finite number of 0 or more. Lower values give more predictable output.
- `maximumResponseTokens` - A positive integer. The response stops at this many tokens. In a session with tools, a very small value (for example 5) can reject with `DECODING_FAILURE`.
- `samplingMode` - How the model picks each token. `greedy` always picks the most likely token. `randomTopK` samples from the `top` most likely tokens (`top` is an integer of 1 or more). `randomProbabilityThreshold` samples from the smallest set of tokens whose probabilities add up to `probabilityThreshold` (greater than 0, at most 1). `seed` is an optional non-negative integer that makes random sampling repeatable.
- `toolCallingMode` - Whether the model may (`allowed`), must (`required`), or must not (`disallowed`) call tools. iOS 27 and later only. iOS 26 ignores it. With `required`, the model calls a tool at every step. On the iOS 27.0 simulator it kept calling the tool and the request did not end normally, so prefer `allowed` unless your tool loop has an exit.

### `StructuredGenerationOptions`

```typescript
type ObjectSchema = z.ZodObject<any>;

interface StructuredGenerationOptions<S extends ObjectSchema> extends GenerationOptions {
  schema: S;
}
```

### `DeepPartial`

The type of a streamed partial object. Every field is optional, and every string type (including enums and literals) widens to `string`, because a partial value can be incomplete.

```typescript
type DeepPartial<T> = T extends string
  ? string
  : T extends readonly (infer Element)[]
    ? DeepPartial<Element>[]
    : T extends object
      ? { [Key in keyof T]?: DeepPartial<T[Key]> }
      : T;
```

### `LanguageModelSessionOptions`

```typescript
type LanguageModelSessionOptions = {
  tools?: ToolDefinition[];
  useCase?: 'general' | 'contentTagging';
  guardrails?: 'default' | 'permissiveContentTransformations';
} & (
  | { instructions?: string; transcript?: never }
  | { transcript: SerializedTranscript; instructions?: never }
);
```

### `SerializedTranscript`

A session transcript in Apple's `Transcript` JSON format, typed as a branded string.

```typescript
type SerializedTranscript = string & { readonly [brand]: 'SerializedTranscript' };
```

The format belongs to Apple and carries a version (`"version":"1.1"` on iOS 27). The only promise is that a value read from `session.transcript` restores through `new LanguageModelSession({ transcript })`. Do not build or edit one by hand. A value read back from storage needs a cast: `stored as SerializedTranscript`.

The decoder rejects versions, entry roles, and segment types it does not know. On iOS 27 it rejects every version other than `1.1`. A transcript that holds iOS 27-only content, such as reasoning entries or attachment segments, is therefore not expected to restore on iOS 26. Restoring on iOS 26 was not tested. Treat `INVALID_TRANSCRIPT` as a normal outcome after an OS update, and start a new session when it occurs.

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
- `SCHEMA_CREATION_ERROR` - A tool or response schema uses a feature the model does not support
- `ARGUMENT_PARSING_ERROR` - Failed to parse tool arguments
- `RESPONSE_PARSING_ERROR` - Failed to parse tool response
- `RESPONSE_VALIDATION_ERROR` - A structured response does not match its schema. `details.issues` holds the Zod issues
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
- `INVALID_GENERATION_OPTIONS` - A `GenerationOptions` value is invalid. `details.field` names the field
- `INVALID_SESSION_OPTIONS` - The session options combine `instructions` and `transcript`
- `INVALID_TRANSCRIPT` - The `transcript` option cannot be decoded. It is not valid JSON, not a transcript, or holds a version or content this OS does not know
- `TRANSCRIPT_ENCODING_ERROR` - `session.transcript` could not encode the conversation

The same failure has the same code on iOS 26 and iOS 27.

### `StreamingOptions`

```typescript
interface StreamingOptions extends GenerationOptions {
  onToken?: (token: string) => void;
  onComplete?: (fullResponse: string) => void;
  onError?: (error: AppleAIError) => void;
}
```

The generation fields apply to that stream. The callbacks are not sent to the model.

## Utilities

### `createTool(definition)`

Helper function to create type-safe tools with Zod schema validation.

```typescript
function createTool<T extends ObjectSchema>(definition: {
  name: string;
  description: string;
  arguments: T;
  handler: (params: z.infer<T>) => Promise<AnyMap>;
}): ToolDefinition
```

The Zod schema you pass is the exact contract the model sees. The same rules apply to the `schema` of a structured response. Supported schema features:

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
