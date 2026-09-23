# react-native-foundation-models

React Native Nitro module for Apple's Foundation Models (Apple Intelligence). Enables AI capabilities in React Native applications using Apple's on-device model, with tool calling support and streaming responses on iOS 26.0+.

## Requirements

- iOS 26.0 or later
- Apple Intelligence enabled in Settings > Apple Intelligence & Siri
- Compatible Apple devices (Apple Silicon Macs, recent iPhones/iPads)
- React Native with Nitro modules support

## Installation

```sh
npm install react-native-foundation-models react-native-nitro-modules
yarn add react-native-foundation-models react-native-nitro-modules
bun add react-native-foundation-models react-native-nitro-modules
```

## Usage

### Basic Chat Session

```typescript
import { LanguageModelSession } from 'react-native-foundation-models';

const session = new LanguageModelSession({
  instructions: 'You are a helpful assistant',
  useCase: 'general',
  guardrails: 'default',
});

const response = await session.respond('Hello, how are you?');
console.log('Response:', response);
```

### Streaming Chat Session

```typescript
import { LanguageModelSession } from 'react-native-foundation-models';

const session = new LanguageModelSession({
  instructions: 'You are a helpful assistant'
});

await session.streamResponse('Hello, how are you?', (responseSoFar) => {
  console.log('Streaming response:', responseSoFar);
});
```

### Generation options

Pass `GenerationOptions` as the last argument to control sampling and length for one request.

```typescript
const answer = await session.respond('Name a color', {
  samplingMode: { kind: 'greedy' },
  maximumResponseTokens: 20,
});

await session.streamResponse('Write a haiku', onChunk, {
  temperature: 0.2,
  samplingMode: { kind: 'randomTopK', top: 40, seed: 1 },
});
```

Fields: `temperature`, `maximumResponseTokens`, `samplingMode` (`greedy`, `randomTopK`, or `randomProbabilityThreshold`), and `toolCallingMode` (`allowed`, `required`, or `disallowed`). `toolCallingMode` needs iOS 27 or later. iOS 26 ignores it. With `required`, the model calls a tool at every step and may not end the request. Invalid values reject with an `INVALID_GENERATION_OPTIONS` error.

`reasoningLevel` (`light`, `moderate`, or `deep`) sets how much the model reasons before it answers. It needs iOS 27 or later and a model with the `reasoning` capability. iOS 26 ignores it. A model without the capability, such as `AFM 3 Core`, rejects the request with `UNSUPPORTED_CAPABILITY`.

```typescript
const { capabilities } = checkFoundationModelsAvailability();
const reasoningLevel = capabilities?.includes('reasoning') ? 'moderate' : undefined;
await session.respond('Plan a 3 day trip', { reasoningLevel });
```

In a session with tools, a very small `maximumResponseTokens` (for example 5) can reject with `DECODING_FAILURE`, because the model uses tokens to decide on tool calls before it writes the answer.

### Structured output

Pass a Zod object schema as `schema`. The model can only generate values that fit it, and the promise resolves with the parsed value.

```typescript
import { z } from 'zod';

const Recipe = z.object({
  title: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  ingredients: z.array(z.object({ name: z.string(), quantity: z.string() })),
  minutes: z.number().int(),
});

const recipe = await session.respond('A quick pasta recipe', { schema: Recipe });
// recipe: { title: string; difficulty: 'easy' | 'medium' | 'hard'; ... }

const final = await session.streamResponse(
  'A quick pasta recipe',
  (partial) => render(partial),
  { schema: Recipe },
);
```

While the stream runs, `onChunk` receives the object generated so far. Fields appear in the order the model writes them, which is not always the schema order. A string field can be incomplete, and an enum field can be `''` before the model picks a value. Partial objects are not validated. The final value is parsed with the schema.

The schema must have `z.object` at the root and follows the same rules as tool arguments (see `createTool` in the API reference). An unsupported schema rejects with `SCHEMA_CREATION_ERROR` before the request. A final value that does not parse (for example, it fails a `.refine()` check the model cannot see) rejects with `RESPONSE_VALIDATION_ERROR`, and `error.details.issues` holds the Zod issues.

The hooks return text only. Call `session.respond` or `session.streamResponse` directly for structured output.

### Token usage

On iOS 27 and later, the session reports the tokens Apple counted. Both values are `undefined` on iOS 26.

```typescript
await session.respond('Plan a 3 day trip');
session.lastResponseUsage;
// { inputTokens, cachedInputTokens, outputTokens, reasoningTokens, totalTokens }
session.usage;
// the same fields, summed over every request in the session
```

`lastResponseUsage.inputTokens` counts the whole conversation the model read, so `inputTokens + outputTokens` is how full the context window is. `usage` keeps counting after a context overflow reset. A session restored from a transcript starts from zero. When the model calls tools, `lastResponseUsage` counts only the final pass and `usage` counts every pass, so use `usage` for budgets.

### Saving and restoring a conversation

`session.transcript` holds the conversation so far, including the instructions. Store it, then pass it to a new session to continue the conversation later.

```typescript
import { LanguageModelSession, type SerializedTranscript } from 'react-native-foundation-models';

await storage.set('chat', session.transcript);

const saved = (await storage.get('chat')) as SerializedTranscript;
const restored = new LanguageModelSession({ transcript: saved, tools: [weatherTool] });
```

A restored session keeps the instructions from its transcript, so `instructions` and `transcript` cannot be used together. TypeScript rejects the combination, and at runtime it throws `INVALID_SESSION_OPTIONS`. Tools are not stored in the transcript. Pass them again. A transcript that cannot be read throws `INVALID_TRANSCRIPT`.

The transcript JSON format belongs to Apple and carries a version (`"version":"1.1"` on iOS 27). The decoder rejects versions, entry roles, and segment types it does not know. A transcript that holds iOS 27-only content, such as reasoning entries or attachment segments, is therefore not expected to restore on iOS 26 and fails with `INVALID_TRANSCRIPT`. Restoring on iOS 26 was not tested. Treat `INVALID_TRANSCRIPT` as a normal outcome after an OS update, and start a new session when it occurs.

Call `session.prewarm(promptPrefix?)` when a request is likely soon, for example when a chat screen opens. The system then loads the model resources before the first request.

### Using React Hooks

```typescript
import { useLanguageModel } from 'react-native-foundation-models';

function ChatComponent() {
  const { send, response, loading, error, isSessionReady } = useLanguageModel({
    instructions: 'You are a helpful coding assistant',
    onResponse: (response) => console.log('Got response:', response),
    onError: (error) => console.error('Error:', error)
  });

  const handleSendMessage = async () => {
    if (isSessionReady) {
      await send('Explain React hooks');
    }
  };

  return (
    <View>
      <Text>{response}</Text>
      <Button onPress={handleSendMessage} disabled={loading} title="Send" />
    </View>
  );
}
```

### Tool calling

```typescript
import { createTool, LanguageModelSession } from 'react-native-foundation-models';
import { z } from 'zod';

const weatherTool = createTool({
  name: 'weather_tool',
  description: 'Get current weather for a city',
  arguments: z.object({
    city: z.string(),
  }),
  handler: async (args) => {
    const response = await fetch(`/weather?city=${args.city}`);
    const res = await response.json();
    return res.data
  },
});

const session = new LanguageModelSession({
  instructions: 'You are a weather assistant',
  tools: [weatherTool]
});
```

## API Reference

### `LanguageModelSession`

Core class for managing AI conversations.

```typescript
constructor(config?: {
  instructions?: string;
  transcript?: SerializedTranscript;
  tools?: Tool[];
  useCase?: 'general' | 'contentTagging';
  guardrails?: 'default' | 'permissiveContentTransformations';
})
```

The library now creates sessions with an explicit `SystemLanguageModel`, which lets you opt into Foundation Models use cases and guardrails from React Native.

Methods:
- `respond(prompt, options?)` - Generate a complete response and resolve when finished. With `options.schema`, resolve with the parsed object
- `streamResponse(prompt, onChunk, options?)` - Stream the response progressively. With `options.schema`, `onChunk` receives partial objects
- `prewarm(promptPrefix?)` - Load the model resources before the first request
- `transcript` - The conversation so far as a `SerializedTranscript`, to restore with `new LanguageModelSession({ transcript })`
- `usage` - Tokens used by all requests in this session (iOS 27+)
- `lastResponseUsage` - Tokens used by the latest request (iOS 27+)

### `useLanguageModel(config)`

React hook for session management with automatic lifecycle handling.

Returns:
- `session` - The current session instance
- `response` - Latest AI response
- `loading` - Whether a request is in progress
- `error` - Any error that occurred
- `send(prompt, options?)` - Send a message to the AI
- `reset()` - Reset the conversation state
- `isSessionReady` - Whether the session is ready to use

### `useStreamingResponse(session)`

Lower-level hook for streaming responses.

### `checkFoundationModelsAvailability()`

Check if Apple Intelligence is available on the device.

The returned object also includes:

- `contextSize`: current library context budget in tokens
- `modelFamily`: `'26.0-26.3'` or `'26.4+'` based on the OS version (deprecated)
- `variant`: the model display name, for example `'AFM 3 Core'` (iOS 27+)
- `capabilities`: the model features, a list of `'vision'`, `'guidedGeneration'`, `'reasoning'`, and `'toolCalling'` (iOS 27+)

### `getFoundationModelsModelFamily()`

Deprecated. Returns a guess from the OS version: `'26.0-26.3'` or `'26.4+'`. Every iOS 27 model reports `'26.4+'`, so read `variant` on iOS 27 and later.

### `getFoundationModelsContextSize()`

Returns the library's current context budget in tokens. Apple documents a 4,096-token context window for the on-device model in iOS 26.0 through 26.3, so the library currently surfaces that value until it can be wired to the native `SystemLanguageModel.contextSize` API with an iOS 26.4 SDK.

## Foundation Models 26.4 Notes

- Apple’s current docs split the on-device model into two version families: `26.0-26.3` and `26.4+`. The library exposes this as `modelFamily` so apps can version prompts when model behavior changes.
- Exact native token measurement with `SystemLanguageModel.tokenCount(for:)` is not compiled into this branch yet because the installed Xcode SDK here is `iPhoneOS26.2`, which does not expose that symbol. Once the project moves to an SDK that includes the 26.4 APIs, the JS surface can adopt the native token counter without another breaking API change.

## Development

This project uses a workspace structure with:
- `package/` - The nitro module source code
- `example/` - Example app demonstrating usage

### Setup

```sh
bun install
bun run build
```

### Running the example

```sh
cd example
bun start    # Start Expo dev server
bun ios      # Run on iOS
```

Note: Android is not supported as this module requires Apple's Foundation Models framework.
