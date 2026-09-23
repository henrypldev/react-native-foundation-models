import { AppleAIError } from './errors'
import type {
  NativeGenerationOptions,
  NativeToolCallingMode,
} from './specs/LanguageModelSession.nitro'
import type { GenerationOptions, SamplingMode, ToolCallingMode } from './types'

interface NumberRule {
  requirement: string
  isValid: (value: number) => boolean
}

const rules = {
  temperature: {
    requirement: 'must be a finite number greater than or equal to 0',
    isValid: value => Number.isFinite(value) && value >= 0,
  },
  maximumResponseTokens: {
    requirement: 'must be a positive integer',
    isValid: value => Number.isSafeInteger(value) && value > 0,
  },
  top: {
    requirement: 'must be an integer greater than or equal to 1',
    isValid: value => Number.isSafeInteger(value) && value >= 1,
  },
  probabilityThreshold: {
    requirement: 'must be a number greater than 0 and less than or equal to 1',
    isValid: value => value > 0 && value <= 1,
  },
  seed: {
    requirement: 'must be an integer greater than or equal to 0',
    isValid: value => Number.isSafeInteger(value) && value >= 0,
  },
} satisfies Record<string, NumberRule>

type NativeSampling = Pick<
  NativeGenerationOptions,
  'samplingMode' | 'samplingTop' | 'samplingProbabilityThreshold' | 'samplingSeed'
>

const samplingModes: {
  [Kind in SamplingMode['kind']]: (
    mode: Extract<SamplingMode, { kind: Kind }>,
  ) => NativeSampling
} = {
  greedy: () => ({ samplingMode: 'greedy' }),
  randomTopK: mode => ({
    samplingMode: 'randomTopK',
    samplingTop: requiredNumber('samplingMode.top', mode.top, rules.top),
    samplingSeed: optionalNumber('samplingMode.seed', mode.seed, rules.seed),
  }),
  randomProbabilityThreshold: mode => ({
    samplingMode: 'randomProbabilityThreshold',
    samplingProbabilityThreshold: requiredNumber(
      'samplingMode.probabilityThreshold',
      mode.probabilityThreshold,
      rules.probabilityThreshold,
    ),
    samplingSeed: optionalNumber('samplingMode.seed', mode.seed, rules.seed),
  }),
}

const toolCallingModes: Record<ToolCallingMode, NativeToolCallingMode> = {
  allowed: 'allowed',
  required: 'required',
  disallowed: 'disallowed',
}

function invalid(field: string, value: unknown, requirement: string): AppleAIError {
  return new AppleAIError(
    'INVALID_GENERATION_OPTIONS',
    `Invalid generation option \`${field}\`: ${requirement}`,
    { field, value },
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasKey<T extends object>(table: T, key: unknown): key is keyof T {
  return typeof key === 'string' && Object.hasOwn(table, key)
}

function requiredNumber(field: string, value: unknown, rule: NumberRule): number {
  if (typeof value !== 'number' || !rule.isValid(value)) {
    throw invalid(field, value, rule.requirement)
  }
  return value
}

function optionalNumber(
  field: string,
  value: unknown,
  rule: NumberRule,
): number | undefined {
  return value === undefined ? undefined : requiredNumber(field, value, rule)
}

function toNativeSampling(mode: unknown): NativeSampling {
  if (mode === undefined) {
    return {}
  }
  if (!isRecord(mode)) {
    throw invalid('samplingMode', mode, 'must be an object with a `kind`')
  }
  if (!hasKey(samplingModes, mode.kind)) {
    throw invalid(
      'samplingMode.kind',
      mode.kind,
      `must be one of ${Object.keys(samplingModes).join(', ')}`,
    )
  }
  const toNative = samplingModes[mode.kind] as (mode: SamplingMode) => NativeSampling
  return toNative(mode as SamplingMode)
}

function toNativeToolCallingMode(mode: unknown): NativeToolCallingMode | undefined {
  if (mode === undefined) {
    return undefined
  }
  if (!hasKey(toolCallingModes, mode)) {
    throw invalid(
      'toolCallingMode',
      mode,
      `must be one of ${Object.keys(toolCallingModes).join(', ')}`,
    )
  }
  return toolCallingModes[mode]
}

export function toNativeGenerationOptions(
  options: GenerationOptions | undefined,
): NativeGenerationOptions | undefined {
  if (options === undefined) {
    return undefined
  }
  if (!isRecord(options)) {
    throw invalid('options', options, 'must be an object')
  }
  return {
    temperature: optionalNumber('temperature', options.temperature, rules.temperature),
    maximumResponseTokens: optionalNumber(
      'maximumResponseTokens',
      options.maximumResponseTokens,
      rules.maximumResponseTokens,
    ),
    ...toNativeSampling(options.samplingMode),
    toolCallingMode: toNativeToolCallingMode(options.toolCallingMode),
  }
}
