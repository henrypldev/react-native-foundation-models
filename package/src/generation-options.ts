import { z } from 'zod'
import { AppleAIError } from './errors'
import type { NativeGenerationOptions } from './specs/LanguageModelSession.nitro'
import type { GenerationOptions } from './types'

const seed = z.int().min(0).optional()

const samplingMode = z.discriminatedUnion('kind', [
  z
    .object({ kind: z.literal('greedy') })
    .transform(mode => ({ samplingMode: mode.kind })),
  z
    .object({ kind: z.literal('randomTopK'), top: z.int().min(1), seed })
    .transform(mode => ({
      samplingMode: mode.kind,
      samplingTop: mode.top,
      samplingSeed: mode.seed,
    })),
  z
    .object({
      kind: z.literal('randomProbabilityThreshold'),
      probabilityThreshold: z.number().gt(0).max(1),
      seed,
    })
    .transform(mode => ({
      samplingMode: mode.kind,
      samplingProbabilityThreshold: mode.probabilityThreshold,
      samplingSeed: mode.seed,
    })),
])

const generationOptions = z
  .object({
    temperature: z.number().min(0).optional(),
    maximumResponseTokens: z.int().positive().optional(),
    samplingMode: samplingMode.optional(),
    toolCallingMode: z.enum(['allowed', 'required', 'disallowed']).optional(),
    reasoningLevel: z.enum(['light', 'moderate', 'deep']).optional(),
  })
  .transform(({ samplingMode, ...rest }) => ({
    ...rest,
    ...samplingMode,
  })) satisfies z.ZodType<NativeGenerationOptions, GenerationOptions>

export function toNativeGenerationOptions(
  options: GenerationOptions | undefined,
): NativeGenerationOptions | undefined {
  if (options === undefined) {
    return undefined
  }
  const result = generationOptions.safeParse(options, { reportInput: true })
  if (result.success) {
    return result.data
  }
  const [issue] = result.error.issues
  const field = issue?.path.join('.') || 'options'
  throw new AppleAIError(
    'INVALID_GENERATION_OPTIONS',
    `Invalid generation option \`${field}\`: ${issue?.message}`,
    { field, value: issue?.input },
  )
}
