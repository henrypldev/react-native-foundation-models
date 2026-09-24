import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { HybridObject } from 'react-native-nitro-modules'
import { z } from 'zod'
import type {
  LanguageModelSessionFactory,
  LanguageModelSession as LanguageModelSessionSpec,
} from '../src/specs/LanguageModelSession.nitro'

type NativeSession = Omit<LanguageModelSessionSpec, keyof HybridObject<{ ios: 'swift' }>>

let nativeSession: NativeSession
let createSession: () => NativeSession

const factory = {
  isAvailable: true,
  availabilityStatus: 'available',
  contextSize: 4096,
  create: () => createSession(),
} satisfies Omit<
  LanguageModelSessionFactory,
  keyof HybridObject<{ ios: 'swift' }> | 'create'
> & {
  create: () => NativeSession
}

mock.module('react-native-nitro-modules', () => ({
  NitroModules: {
    createHybridObject: () => factory,
  },
}))

mock.module('react-native', () => ({
  Platform: { OS: 'ios', Version: '26.4' },
}))

const { LanguageModelSession } = await import('../src/LanguageModelSession')

beforeEach(() => {
  nativeSession = {
    respond: async () => 'response',
    streamResponse: async (_prompt, onChunk) => {
      onChunk('partial')
      onChunk('complete')
      return 'complete'
    },
    tokenCount: async () => 3,
    wasContextReset: false,
  }
  createSession = () => nativeSession
})

describe('LanguageModelSession native boundary', () => {
  test('normalizes opaque streaming failures with operation diagnostics', async () => {
    nativeSession.streamResponse = async () => {
      throw new Error('Unknown native C++ error')
    }

    const session = new LanguageModelSession()

    await expect(session.streamResponse('Hello', () => {})).rejects.toMatchObject({
      name: 'AppleAIError',
      code: 'SESSION_STREAMING_ERROR',
      message: 'Unknown native C++ error',
      details: {
        operation: 'streamResponse',
        nativeName: 'Error',
      },
    })
  })

  test('preserves a typed native generation failure', async () => {
    nativeSession.streamResponse = async () => {
      throw new Error('[GUARDRAIL_VIOLATION] The request violated model guardrails')
    }

    const session = new LanguageModelSession()

    await expect(session.streamResponse('Hello', () => {})).rejects.toMatchObject({
      code: 'GUARDRAIL_VIOLATION',
      message: 'The request violated model guardrails',
    })
  })

  test('contains chunk callback exceptions and returns a typed rejection', async () => {
    const session = new LanguageModelSession()

    const result = session.streamResponse('Hello', () => {
      throw new Error('render failed')
    })

    await expect(result).rejects.toMatchObject({
      name: 'AppleAIError',
      code: 'STREAM_CALLBACK_ERROR',
      message: 'Streaming callback failed: render failed',
      details: {
        operation: 'streamResponse.onChunk',
        causeCode: 'UNKNOWN_ERROR',
      },
    })
  })

  test('normalizes non-streaming native failures separately', async () => {
    nativeSession.respond = async () => {
      throw new Error('Unknown native C++ error')
    }

    const session = new LanguageModelSession()

    await expect(session.respond('Hello')).rejects.toMatchObject({
      code: 'SESSION_RESPONSE_ERROR',
      details: { operation: 'respond' },
    })
  })

  test('normalizes synchronous session creation failures', () => {
    createSession = () => {
      throw new Error('Native session creation failed')
    }

    expect(() => new LanguageModelSession()).toThrow(
      expect.objectContaining({
        name: 'AppleAIError',
        code: 'SESSION_INITIALIZATION_ERROR',
        details: expect.objectContaining({ operation: 'createSession' }),
      }),
    )
  })

  test('forwards converted generation options to the native session', async () => {
    const respond = mock(async () => 'response')
    const streamResponse = mock(async () => 'complete')
    nativeSession.respond = respond
    nativeSession.streamResponse = streamResponse
    const onChunk = () => {}

    const session = new LanguageModelSession()
    await session.respond('Hello', {
      maximumResponseTokens: 5,
      samplingMode: { kind: 'greedy' },
    })
    await session.streamResponse('Hello', onChunk, {
      samplingMode: { kind: 'randomTopK', top: 3, seed: 1 },
    })

    expect(respond).toHaveBeenCalledWith(
      'Hello',
      undefined,
      expect.objectContaining({ maximumResponseTokens: 5, samplingMode: 'greedy' }),
    )
    expect(streamResponse).toHaveBeenCalledWith(
      'Hello',
      expect.any(Function),
      undefined,
      expect.objectContaining({
        samplingMode: 'randomTopK',
        samplingTop: 3,
        samplingSeed: 1,
      }),
    )
  })

  test('rejects invalid generation options without calling native', async () => {
    const respond = mock(async () => 'response')
    const streamResponse = mock(async () => 'complete')
    nativeSession.respond = respond
    nativeSession.streamResponse = streamResponse

    const session = new LanguageModelSession()

    await expect(session.respond('Hello', { temperature: -1 })).rejects.toMatchObject({
      code: 'INVALID_GENERATION_OPTIONS',
      details: { field: 'temperature', value: -1 },
    })
    await expect(
      session.streamResponse('Hello', () => {}, { toolCallingMode: 'never' as never }),
    ).rejects.toMatchObject({
      code: 'INVALID_GENERATION_OPTIONS',
      details: { field: 'toolCallingMode' },
    })
    expect(respond).not.toHaveBeenCalled()
    expect(streamResponse).not.toHaveBeenCalled()
  })
})

const Recipe = z.object({
  title: z.string(),
  difficulty: z.enum(['easy', 'hard']),
  ingredients: z.array(z.object({ name: z.string(), grams: z.number() })),
  servings: z.number().default(2),
})

const recipeJson = JSON.stringify({
  title: 'Pasta',
  difficulty: 'easy',
  ingredients: [{ name: 'spaghetti', grams: 200 }],
})

describe('LanguageModelSession structured output', () => {
  test('sends the sanitized response schema and resolves with the parsed value', async () => {
    const respond = mock(async () => recipeJson)
    nativeSession.respond = respond

    const session = new LanguageModelSession()
    const recipe = await session.respond('A pasta recipe', {
      schema: Recipe,
      samplingMode: { kind: 'greedy' },
    })

    expect(recipe).toEqual({
      title: 'Pasta',
      difficulty: 'easy',
      ingredients: [{ name: 'spaghetti', grams: 200 }],
      servings: 2,
    })
    expect(respond).toHaveBeenCalledWith(
      'A pasta recipe',
      {
        type: 'object',
        properties: {
          title: { type: 'string' },
          difficulty: { type: 'string', enum: ['easy', 'hard'] },
          ingredients: {
            type: 'array',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, grams: { type: 'number' } },
              required: ['name', 'grams'],
            },
          },
          servings: { type: 'number' },
        },
        required: ['title', 'difficulty', 'ingredients'],
      },
      expect.objectContaining({ samplingMode: 'greedy' }),
    )
  })

  test('rejects a response that does not match the schema with the Zod issues', async () => {
    nativeSession.respond = async () =>
      JSON.stringify({ title: 'Pasta', difficulty: 'medium', ingredients: [] })

    const session = new LanguageModelSession()

    await expect(
      session.respond('A pasta recipe', { schema: Recipe }),
    ).rejects.toMatchObject({
      name: 'AppleAIError',
      code: 'RESPONSE_VALIDATION_ERROR',
      details: {
        issues: [expect.objectContaining({ path: ['difficulty'] })],
        response: { title: 'Pasta', difficulty: 'medium', ingredients: [] },
      },
    })
  })

  test('rejects a response that is not JSON', async () => {
    nativeSession.respond = async () => '{"title": "Pas'

    const session = new LanguageModelSession()

    await expect(
      session.respond('A pasta recipe', { schema: Recipe }),
    ).rejects.toMatchObject({
      code: 'RESPONSE_VALIDATION_ERROR',
      details: { response: '{"title": "Pas' },
    })
  })

  test('rejects an unsupported schema before the request reaches native', async () => {
    const respond = mock(async () => '{}')
    nativeSession.respond = respond

    const session = new LanguageModelSession()

    await expect(
      session.respond('Hello', {
        schema: z.object({ id: z.union([z.string(), z.number()]) }),
      }),
    ).rejects.toMatchObject({
      code: 'SCHEMA_CREATION_ERROR',
      message: expect.stringContaining("'response.id'"),
    })
    expect(respond).not.toHaveBeenCalled()
  })

  test('rejects a schema without an object at the root', async () => {
    const session = new LanguageModelSession()

    await expect(
      session.respond('Hello', { schema: z.string() as never }),
    ).rejects.toMatchObject({
      code: 'SCHEMA_CREATION_ERROR',
      message: expect.stringContaining("'response'"),
    })
  })

  test('preserves typed native failures from the schema request', async () => {
    nativeSession.respond = async () => {
      throw new Error('[CONTEXT_EXCEEDED] The context window is full')
    }

    const session = new LanguageModelSession()

    await expect(session.respond('Hello', { schema: Recipe })).rejects.toMatchObject({
      code: 'CONTEXT_EXCEEDED',
    })
  })

  test('streams unvalidated partial objects and resolves with the parsed value', async () => {
    nativeSession.streamResponse = async (_prompt, onChunk) => {
      onChunk('{"title": "Pa"}')
      onChunk('{"difficulty": "", "title": "Pasta"}')
      onChunk('{"title": "Pasta", "difficulty": "easy", "ingredients": [{}]}')
      onChunk(recipeJson)
      return recipeJson
    }
    const partials: unknown[] = []

    const session = new LanguageModelSession()
    const recipe = await session.streamResponse(
      'A pasta recipe',
      partial => partials.push(partial),
      { schema: Recipe },
    )

    expect(partials).toEqual([
      { title: 'Pa' },
      { difficulty: '', title: 'Pasta' },
      { title: 'Pasta', difficulty: 'easy', ingredients: [{}] },
      JSON.parse(recipeJson),
    ])
    expect(recipe.servings).toBe(2)
  })

  test('rejects a stream whose final value does not match the schema', async () => {
    nativeSession.streamResponse = async (_prompt, onChunk) => {
      onChunk('{"title": "Pasta"}')
      return '{"title": "Pasta"}'
    }

    const session = new LanguageModelSession()

    await expect(
      session.streamResponse('A pasta recipe', () => {}, { schema: Recipe }),
    ).rejects.toMatchObject({
      code: 'RESPONSE_VALIDATION_ERROR',
      message: expect.stringContaining('difficulty'),
    })
  })

  test('rejects a stream whose snapshot is not JSON instead of blaming the callback', async () => {
    const onChunk = mock(() => {})
    nativeSession.streamResponse = async (_prompt, emit) => {
      emit('{"title": "Pa')
      return recipeJson
    }

    const session = new LanguageModelSession()

    await expect(
      session.streamResponse('A pasta recipe', onChunk, { schema: Recipe }),
    ).rejects.toMatchObject({ code: 'RESPONSE_VALIDATION_ERROR' })
    expect(onChunk).not.toHaveBeenCalled()
  })
})
