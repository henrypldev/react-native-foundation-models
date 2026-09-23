import { describe, expect, test } from 'bun:test'
import { AppleAIError } from '../src/errors'
import { toNativeGenerationOptions } from '../src/generation-options'
import type { GenerationOptions } from '../src/types'

const rejection = (options: unknown) => {
  try {
    toNativeGenerationOptions(options as GenerationOptions)
  } catch (error) {
    return error
  }
  throw new Error('expected toNativeGenerationOptions to throw')
}

describe('toNativeGenerationOptions', () => {
  test('passes undefined through', () => {
    expect(toNativeGenerationOptions(undefined)).toBeUndefined()
  })

  test('flattens each sampling mode into the native struct', () => {
    expect(
      toNativeGenerationOptions({
        temperature: 0.7,
        maximumResponseTokens: 64,
        samplingMode: { kind: 'greedy' },
        toolCallingMode: 'disallowed',
        reasoningLevel: 'deep',
      }),
    ).toEqual({
      temperature: 0.7,
      maximumResponseTokens: 64,
      samplingMode: 'greedy',
      toolCallingMode: 'disallowed',
      reasoningLevel: 'deep',
    })

    expect(
      toNativeGenerationOptions({
        samplingMode: { kind: 'randomTopK', top: 40, seed: 7 },
      }),
    ).toEqual({ samplingMode: 'randomTopK', samplingTop: 40, samplingSeed: 7 })

    expect(
      toNativeGenerationOptions({
        samplingMode: { kind: 'randomProbabilityThreshold', probabilityThreshold: 0.9 },
      }),
    ).toEqual({
      samplingMode: 'randomProbabilityThreshold',
      samplingProbabilityThreshold: 0.9,
    })
  })

  test('copies only known keys', () => {
    const native = toNativeGenerationOptions({
      temperature: 0,
      onToken: () => {},
      samplingMode: { kind: 'greedy', top: 3 },
    } as GenerationOptions)

    expect(
      Object.entries(native ?? {}).filter(([, value]) => value !== undefined),
    ).toEqual([
      ['temperature', 0],
      ['samplingMode', 'greedy'],
    ])
  })

  test('accepts boundary values', () => {
    expect(
      toNativeGenerationOptions({
        temperature: 0,
        maximumResponseTokens: 1,
        samplingMode: { kind: 'randomTopK', top: 1, seed: 0 },
      }),
    ).toEqual({
      temperature: 0,
      maximumResponseTokens: 1,
      samplingMode: 'randomTopK',
      samplingTop: 1,
      samplingSeed: 0,
    })
    expect(
      toNativeGenerationOptions({
        samplingMode: { kind: 'randomProbabilityThreshold', probabilityThreshold: 1 },
      })?.samplingProbabilityThreshold,
    ).toBe(1)
  })

  test.each([
    ['options', 'fast'],
    ['options', null],
    ['options', []],
    ['temperature', { temperature: -0.1 }],
    ['temperature', { temperature: Number.NaN }],
    ['temperature', { temperature: Number.POSITIVE_INFINITY }],
    ['temperature', { temperature: '0.5' }],
    ['maximumResponseTokens', { maximumResponseTokens: 0 }],
    ['maximumResponseTokens', { maximumResponseTokens: 2.5 }],
    ['maximumResponseTokens', { maximumResponseTokens: 2 ** 53 }],
    ['samplingMode', { samplingMode: 'greedy' }],
    ['samplingMode.kind', { samplingMode: { kind: 'nucleus' } }],
    ['samplingMode.kind', { samplingMode: { kind: 'toString' } }],
    ['samplingMode.top', { samplingMode: { kind: 'randomTopK' } }],
    ['samplingMode.top', { samplingMode: { kind: 'randomTopK', top: 0 } }],
    ['samplingMode.top', { samplingMode: { kind: 'randomTopK', top: 1.5 } }],
    [
      'samplingMode.probabilityThreshold',
      { samplingMode: { kind: 'randomProbabilityThreshold', probabilityThreshold: 0 } },
    ],
    [
      'samplingMode.probabilityThreshold',
      {
        samplingMode: { kind: 'randomProbabilityThreshold', probabilityThreshold: 1.01 },
      },
    ],
    [
      'samplingMode.probabilityThreshold',
      { samplingMode: { kind: 'randomProbabilityThreshold' } },
    ],
    ['samplingMode.seed', { samplingMode: { kind: 'randomTopK', top: 5, seed: -1 } }],
    ['samplingMode.seed', { samplingMode: { kind: 'randomTopK', top: 5, seed: 0.5 } }],
    ['toolCallingMode', { toolCallingMode: 'sometimes' }],
    ['reasoningLevel', { reasoningLevel: 'extreme' }],
    ['reasoningLevel', { reasoningLevel: 'toString' }],
    ['reasoningLevel', { reasoningLevel: { custom: 'fast' } }],
  ])('rejects invalid %s: %p', (field, options) => {
    const error = rejection(options)

    expect(error).toBeInstanceOf(AppleAIError)
    expect(error).toMatchObject({
      code: 'INVALID_GENERATION_OPTIONS',
      details: { field },
    })
    expect((error as AppleAIError).message).toContain(`\`${field}\``)
  })
})
