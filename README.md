# react-native-foundation-models

React Native access to Apple's on-device Foundation Models (Apple Intelligence) on iOS 26 and later. It supports streaming, tool calling, structured output from Zod schemas, per-request generation options, transcripts, and token usage.

The full API, every option, and every error code are in the [API reference](https://github.com/henrypldev/react-native-foundation-models/blob/main/docs/docs/api-reference.md).

## Requirements

- iOS 26.0 or later. Token usage, `toolCallingMode`, `reasoningLevel`, and model info need iOS 27.
- Apple Intelligence enabled in Settings > Apple Intelligence & Siri, on a device that supports it.
- `react-native-nitro-modules`.

## Installation

```sh
bun add react-native-foundation-models react-native-nitro-modules
```

## Quickstart

### Check availability

```typescript
import { checkFoundationModelsAvailability } from 'react-native-foundation-models';

const { isAvailable, message, variant, capabilities } = checkFoundationModelsAvailability();
```

`variant` and `capabilities` describe the on-device model on iOS 27 and later.

### Respond and stream

```typescript
import { LanguageModelSession } from 'react-native-foundation-models';

const session = new LanguageModelSession({ instructions: 'You are a helpful assistant' });

const answer = await session.respond('Name a color', { samplingMode: { kind: 'greedy' } });

await session.streamResponse('Write a haiku', (textSoFar) => setText(textSoFar));
```

### Structured output

```typescript
import { z } from 'zod';

const Recipe = z.object({ title: z.string(), ingredients: z.array(z.string()) });

const recipe = await session.respond('A quick pasta recipe', { schema: Recipe });
```

### Tools

```typescript
import { createTool } from 'react-native-foundation-models';

const weatherTool = createTool({
  name: 'weather_tool',
  description: 'Get the current weather for a city',
  arguments: z.object({ city: z.string() }),
  handler: async ({ city }) => fetchWeather(city),
});

const weatherSession = new LanguageModelSession({ tools: [weatherTool] });
```

### Transcripts and token usage

```typescript
const saved = session.transcript;
const restored = new LanguageModelSession({ transcript: saved, tools: [weatherTool] });

await restored.respond('What did we talk about?');
restored.lastResponseUsage?.totalTokens;
restored.usage?.totalTokens;
```

A session starts from `instructions` or from a `transcript`, not both.

### React hook

```typescript
import { useLanguageModel } from 'react-native-foundation-models';

const { send, response, loading } = useLanguageModel({ instructions: 'You are a helpful assistant' });
```

### Errors

Every failure is an `AppleAIError` with a stable `code`, such as `CONTEXT_EXCEEDED` or `INVALID_GENERATION_OPTIONS`. The API reference lists every code.

## Development

- `package/` holds the Nitro module.
- `example/` holds an Expo app with one screen per feature.

```sh
bun install
bun run build
cd example && bun ios
```

Android is not supported, because the module needs Apple's Foundation Models framework.
