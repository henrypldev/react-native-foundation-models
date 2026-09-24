---
sidebar_position: 2
---

# Core Concepts

## Language Model Sessions

The `LanguageModelSession` is the core class that manages AI conversations. Each session maintains context and can be configured with:

- **Instructions**: Define the AI's behavior and role
- **Tools**: Custom functions the AI can invoke
- **Streaming**: Real-time response handling

```typescript
import { LanguageModelSession } from 'react-native-foundation-models';

const session = new LanguageModelSession({
  instructions: "You are a helpful coding assistant.",
  tools: [weatherTool, calculatorTool],
  useCase: 'general',
  guardrails: 'default'
});
```

## Regular Responses

Use `respond()` when you want the full answer only after generation finishes:

```typescript
const response = await session.respond("What is quantum computing?");
console.log(response);
```

## Apple Intelligence Availability

Before using the module, check if Apple Intelligence is available:

```typescript
import { checkFoundationModelsAvailability } from 'react-native-foundation-models';

const availability = checkFoundationModelsAvailability();
console.log(availability.status); // 'available' or 'unavailable.xxx'
console.log(availability.message); // Human-readable message
console.log(availability.contextSize); // Context window in tokens on iOS 26.4+, undefined otherwise
console.log(availability.variant); // Model name on iOS 27+, such as 'AFM 3 Core'
console.log(availability.capabilities); // Model features on iOS 27+, such as ['guidedGeneration', 'toolCalling']
```

### Availability States

- `available`: Ready to use
- `unavailable.platformNotSupported`: iOS version too old (requires 26.0+)
- `unavailable.deviceNotEligible`: Device doesn't support Apple Intelligence
- `unavailable.appleIntelligenceNotEnabled`: Not enabled in Settings
- `unavailable.modelNotReady`: Model downloading or not ready
- `unavailable.unknown`: Unknown reason

### Model Metadata

The library also exposes:

- The model name via `variant` and its features via `capabilities`, on iOS 27 and later. Check `capabilities` before you use a feature that not every model has, such as `reasoningLevel`
- The context window size via `contextSize`, on iOS 26.4 and later
- `modelFamily`, which is deprecated. It is guessed from the iOS version and reports `'26.4+'` for every iOS 27 model

## Tool Calling

Define custom tools that the AI can invoke during conversations:

```typescript
import { z } from 'zod';
import { createTool } from 'react-native-foundation-models';

const weatherTool = createTool({
  name: 'get_weather',
  description: 'Get current weather for a location',
  schema: z.object({
    location: z.string().describe('The city and state/country'),
    unit: z.enum(['celsius', 'fahrenheit']).optional()
  }),
  handler: async ({ location, unit = 'celsius' }) => {
    // Fetch weather data
    return `Weather in ${location}: 22°${unit === 'celsius' ? 'C' : 'F'}`;
  }
});
```

## Streaming Responses

Handle real-time AI responses as they're generated:

```typescript
session.streamResponse("Tell me a story", (responseSoFar: string) => {
  console.log(responseSoFar); // Gets called with the full streamed response so far
});
```

## Error Handling

The module provides specific error types for different failure scenarios:

```typescript
import { AppleAIError, isAppleAIError } from 'react-native-foundation-models';

try {
  await session.streamResponse("Hello", (responseSoFar) => {
    console.log(responseSoFar);
  });
} catch (error) {
  if (isAppleAIError(error)) {
    switch (error.code) {
      case 'SESSION_NOT_INITIALIZED':
        // Handle session not ready
        break;
      case 'TOOL_EXECUTION_ERROR':
        // Handle tool execution failure
        break;
      case 'UNSUPPORTED_PLATFORM':
        // Handle platform not supported
        break;
    }
  }
}
```
