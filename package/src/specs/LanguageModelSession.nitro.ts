import type { AnyMap, HybridObject } from 'react-native-nitro-modules'

export interface ToolDefinition {
  name: string
  description: string
  arguments: AnyMap
  handler: (args: AnyMap) => Promise<AnyMap>
}

export interface LanguageModelSessionConfig {
  instructions?: string
  tools?: Array<ToolDefinition>
  useCase?: string
  guardrails?: string
  transcript?: string
}

export type NativeSamplingMode = 'greedy' | 'randomTopK' | 'randomProbabilityThreshold'

export type NativeToolCallingMode = 'allowed' | 'required' | 'disallowed'

export type NativeReasoningLevel = 'light' | 'moderate' | 'deep'

export type NativeModelCapability =
  | 'vision'
  | 'guidedGeneration'
  | 'reasoning'
  | 'toolCalling'

export interface NativeTokenUsage {
  inputTokens: number
  cachedInputTokens: number
  outputTokens: number
  reasoningTokens: number
  totalTokens: number
}

export interface NativeGenerationOptions {
  temperature?: number
  maximumResponseTokens?: number
  samplingMode?: NativeSamplingMode
  samplingTop?: number
  samplingProbabilityThreshold?: number
  samplingSeed?: number
  toolCallingMode?: NativeToolCallingMode
  reasoningLevel?: NativeReasoningLevel
}

export interface LanguageModelSession extends HybridObject<{ ios: 'swift' }> {
  respond(
    prompt: string,
    schema?: AnyMap,
    options?: NativeGenerationOptions,
  ): Promise<string>
  streamResponse(
    prompt: string,
    onStream: (stream: string) => void,
    schema?: AnyMap,
    options?: NativeGenerationOptions,
  ): Promise<string>
  tokenCount(prompt: string): Promise<number>
  serializeTranscript(): string
  prewarm(promptPrefix?: string): void
  readonly wasContextReset: boolean
  readonly usage?: NativeTokenUsage
  readonly lastResponseUsage?: NativeTokenUsage
}

export interface LanguageModelSessionFactory extends HybridObject<{ ios: 'swift' }> {
  create(config: LanguageModelSessionConfig): LanguageModelSession
  readonly isAvailable: boolean
  readonly availabilityStatus: string
  readonly contextSize?: number
  readonly modelVariant?: string
  readonly modelCapabilities?: Array<NativeModelCapability>
}
