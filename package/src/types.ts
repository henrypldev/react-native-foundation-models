export interface GenerableProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  guide?: {
    description: string
  }
}

export interface GenerableSchema {
  name: string
  properties: Record<string, GenerableProperty>
}

export interface GenerableConfig {
  schemas: GenerableSchema[]
  tools?: Tool[]
  outputPath?: string
  moduleName?: string
}

export interface Tool {
  name: string
  description: string
  arguments: Record<string, GenerableProperty>
  functionName: string
  resultSchema?: Record<string, GenerableProperty>
}

export type SystemLanguageModelUseCase = 'general' | 'contentTagging'

export type SystemLanguageModelGuardrails = 'default' | 'permissiveContentTransformations'

export type FoundationModelsModelFamily = '26.0-26.3' | '26.4+'

/**
 * A feature the on-device model supports. Read the list from
 * `checkFoundationModelsAvailability().capabilities` before you use a feature
 * that not every model has, such as `reasoningLevel`.
 */
export type ModelCapability = 'vision' | 'guidedGeneration' | 'reasoning' | 'toolCalling'

export type AvailabilityStatus =
  | 'available'
  | 'unavailable.platformNotSupported'
  | 'unavailable.deviceNotEligible'
  | 'unavailable.appleIntelligenceNotEnabled'
  | 'unavailable.modelNotReady'
  | 'unavailable.unknown'

export interface FoundationModelsAvailability {
  isAvailable: boolean
  status: AvailabilityStatus
  message: string
  contextSize?: number
  /**
   * @deprecated Guessed from the iOS version, and reports `'26.4+'` for every
   * iOS 27 model. On iOS 27 and later, read `variant` instead.
   */
  modelFamily?: FoundationModelsModelFamily
  /**
   * The display name of the on-device model, such as `'AFM 3 Core'`.
   * iOS 27 and later only. `undefined` on iOS 26.
   */
  variant?: string
  /**
   * The features the on-device model supports. iOS 27 and later only.
   * `undefined` on iOS 26.
   */
  capabilities?: ModelCapability[]
}

/**
 * Token counts that Apple reports for requests. iOS 27 and later only.
 *
 * `cachedInputTokens` is the part of `inputTokens` that the model read from
 * its cache. `reasoningTokens` is the part of `outputTokens` the model spent
 * on reasoning. `totalTokens` is `inputTokens + outputTokens`.
 */
export interface TokenUsage {
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
  totalTokens: number
}

/**
 * How the model picks each next token.
 *
 * - `greedy` always picks the most likely token, so the same prompt gives the same output.
 * - `randomTopK` samples from the `top` most likely tokens. `top` is an integer of 1 or more.
 * - `randomProbabilityThreshold` samples from the smallest set of tokens whose
 *   probabilities add up to `probabilityThreshold`, a number greater than 0 and at most 1.
 *
 * `seed` is an optional non-negative integer that makes random sampling repeatable.
 */
export type SamplingMode =
  | { kind: 'greedy' }
  | { kind: 'randomTopK'; top: number; seed?: number }
  | { kind: 'randomProbabilityThreshold'; probabilityThreshold: number; seed?: number }

/**
 * Whether the model may, must, or must not call the session's tools.
 */
export type ToolCallingMode = 'allowed' | 'required' | 'disallowed'

/**
 * How much the model reasons before it answers.
 */
export type ReasoningLevel = 'light' | 'moderate' | 'deep'

/**
 * Options that control a single `respond` or `streamResponse` request.
 */
export interface GenerationOptions {
  /**
   * Controls how random the output is. A finite number of 0 or more.
   * Lower values give more predictable output.
   */
  temperature?: number
  /**
   * The largest number of tokens the response can contain. A positive integer.
   * The model stops when it reaches this limit.
   */
  maximumResponseTokens?: number
  /**
   * The sampling strategy. The system chooses one when this is not set.
   */
  samplingMode?: SamplingMode
  /**
   * Whether the model may call tools for this request. iOS 27 and later only.
   * iOS 26 ignores this value. With `required`, the model calls a tool at every
   * step and may not end the request.
   */
  toolCallingMode?: ToolCallingMode
  /**
   * How much the model reasons before it answers. iOS 27 and later only.
   * iOS 26 ignores this value. A model without the `reasoning` capability
   * rejects the request with `UNSUPPORTED_CAPABILITY`, so check
   * `checkFoundationModelsAvailability().capabilities` first.
   */
  reasoningLevel?: ReasoningLevel
}

declare const serializedTranscriptBrand: unique symbol

/**
 * A session transcript in Apple's `Transcript` JSON format.
 *
 * The format belongs to Apple and can change between OS versions. The only
 * promise is that a value read from `session.transcript` restores through
 * `new LanguageModelSession({ transcript })`. Do not build or edit one by hand.
 * A value read back from storage needs a cast: `stored as SerializedTranscript`.
 */
export type SerializedTranscript = string & {
  readonly [serializedTranscriptBrand]: 'SerializedTranscript'
}
