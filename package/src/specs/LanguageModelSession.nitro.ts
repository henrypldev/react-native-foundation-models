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
}

export type NativeSamplingMode = 'greedy' | 'randomTopK' | 'randomProbabilityThreshold'

export type NativeToolCallingMode = 'allowed' | 'required' | 'disallowed'

export interface NativeGenerationOptions {
  temperature?: number
  maximumResponseTokens?: number
  samplingMode?: NativeSamplingMode
  samplingTop?: number
  samplingProbabilityThreshold?: number
  samplingSeed?: number
  toolCallingMode?: NativeToolCallingMode
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
  readonly wasContextReset: boolean
}

export interface LanguageModelSessionFactory extends HybridObject<{ ios: 'swift' }> {
  create(config: LanguageModelSessionConfig): LanguageModelSession
  readonly isAvailable: boolean
  readonly availabilityStatus: string
  readonly contextSize?: number
}
