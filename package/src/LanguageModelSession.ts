import { Platform } from 'react-native'
import { type AnyMap, NitroModules } from 'react-native-nitro-modules'
import type { z } from 'zod'
import { AppleAIError, parseNativeError } from './errors'
import { toNativeGenerationOptions } from './generation-options'
import { type ObjectSchema, toGenerationSchema } from './generation-schema'
import type {
  LanguageModelSessionConfig,
  LanguageModelSessionFactory as LanguageModelSessionFactorySpec,
  LanguageModelSession as LanguageModelSessionSpec,
  NativeGenerationOptions,
} from './specs/LanguageModelSession.nitro'
import {
  type DeepPartial,
  parseResponseJson,
  parseResponse,
  type StructuredGenerationOptions,
} from './structured-output'
import type {
  AvailabilityStatus,
  FoundationModelsAvailability,
  FoundationModelsModelFamily,
  GenerationOptions,
  SerializedTranscript,
  SystemLanguageModelGuardrails,
  SystemLanguageModelUseCase,
} from './types'

const LanguageModelSessionFactory =
  NitroModules.createHybridObject<LanguageModelSessionFactorySpec>(
    'LanguageModelSessionFactory',
  )

interface ResponseRequest {
  schema: AnyMap | undefined
  options: NativeGenerationOptions | undefined
  decodeChunk: (raw: string) => unknown
  parse: (raw: string) => unknown
}

const unchanged = (raw: string) => raw

function responseRequest(
  options?: Partial<StructuredGenerationOptions<ObjectSchema>>,
): ResponseRequest {
  const nativeOptions = toNativeGenerationOptions(options)
  const schema = options?.schema
  if (!schema) {
    return {
      schema: undefined,
      options: nativeOptions,
      decodeChunk: unchanged,
      parse: unchanged,
    }
  }
  return {
    schema: toGenerationSchema(schema, 'response'),
    options: nativeOptions,
    decodeChunk: parseResponseJson,
    parse: raw => parseResponse(schema, raw),
  }
}

/**
 * Options for a new session. A session starts either from `instructions` or
 * from a `transcript` saved from an earlier session, not both. A restored
 * session keeps the instructions stored in its transcript.
 */
export type LanguageModelSessionOptions = {
  tools?: LanguageModelSessionConfig['tools']
  useCase?: SystemLanguageModelUseCase
  guardrails?: SystemLanguageModelGuardrails
} & (
  | { instructions?: string; transcript?: never }
  | { transcript: SerializedTranscript; instructions?: never }
)

/**
 * Gets a human-readable message for the availability status
 */
function getAvailabilityMessage(status: AvailabilityStatus): string {
  switch (status) {
    case 'available':
      return 'Foundation Models is available and ready to use'
    case 'unavailable.platformNotSupported':
      return 'Foundation Models requires iOS 26.0 or later'
    case 'unavailable.deviceNotEligible':
      return 'This device does not support Apple Intelligence'
    case 'unavailable.appleIntelligenceNotEnabled':
      return 'Apple Intelligence is not enabled in Settings'
    case 'unavailable.modelNotReady':
      return 'The model is downloading or not ready for other system reasons'
    case 'unavailable.unknown':
      return 'Foundation Models is unavailable for an unknown reason'
    default:
      return 'Foundation Models availability status is unknown'
  }
}

function parseIOSVersion(versionValue: string | number): {
  major: number
  minor: number
} | null {
  const match = String(versionValue).match(/^(\d+)(?:\.(\d+))?/)
  if (!match) {
    return null
  }

  return {
    major: Number.parseInt(match[1] ?? '0', 10),
    minor: Number.parseInt(match[2] ?? '0', 10),
  }
}

export function getFoundationModelsModelFamily():
  | FoundationModelsModelFamily
  | undefined {
  if (Platform.OS !== 'ios') {
    return undefined
  }

  const version = parseIOSVersion(Platform.Version)
  if (!version) {
    return undefined
  }

  if (version.major > 26 || (version.major === 26 && version.minor >= 4)) {
    return '26.4+'
  }

  return '26.0-26.3'
}

/**
 * Returns the default system language model's context window size in tokens.
 *
 * Backed by `SystemLanguageModel.contextSize`, which is only available on
 * iOS 26.4 or later. Returns `undefined` on earlier versions or non-iOS
 * platforms.
 */
export function getFoundationModelsContextSize(): number | undefined {
  try {
    return LanguageModelSessionFactory.contextSize
  } catch (_error) {
    return undefined
  }
}

/**
 * Checks the availability of Foundation Models
 * @returns FoundationModelsAvailability object with detailed status
 */
export function checkFoundationModelsAvailability(): FoundationModelsAvailability {
  try {
    const isAvailable = LanguageModelSessionFactory.isAvailable
    const statusString = LanguageModelSessionFactory.availabilityStatus
    const status = statusString.startsWith('unavailable.unknown(')
      ? ('unavailable.unknown' as const)
      : (statusString as AvailabilityStatus)

    return {
      isAvailable,
      status,
      message: getAvailabilityMessage(status),
      contextSize: getFoundationModelsContextSize(),
      modelFamily: getFoundationModelsModelFamily(),
    }
  } catch (_error) {
    return {
      isAvailable: false,
      status: 'unavailable.platformNotSupported',
      message: getAvailabilityMessage('unavailable.platformNotSupported'),
      contextSize: getFoundationModelsContextSize(),
      modelFamily: getFoundationModelsModelFamily(),
    }
  }
}

/**
 * LanguageModelSession provides a bridge to Apple's native language model capabilities
 * for React Native applications. This class manages AI-powered conversations with
 * support for custom instructions and tool integration.
 *
 * @example
 * ```typescript
 * const session = new LanguageModelSession();
 *
 * // With custom instructions
 * const session = new LanguageModelSession({
 *   instructions: "You are a helpful assistant"
 * });
 *
 * // With instructions and tools
 * const tools = [myCustomTool];
 * const session = new LanguageModelSession({
 *   instructions: "You are a coding assistant",
 *   tools
 * });
 * ```
 */
export class LanguageModelSession {
  session: LanguageModelSessionSpec

  /**
   * Creates a new LanguageModelSession instance
   *
   * @param instructions - Optional system instructions to guide the AI's behavior
   * @param tools - Optional array of tools that the AI can use during conversations
   */
  constructor(config?: LanguageModelSessionOptions) {
    const availability = checkFoundationModelsAvailability()
    if (!availability.isAvailable) {
      throw new AppleAIError(
        'MODEL_UNAVAILABLE',
        `Foundation Models is not available: ${availability.message}`,
        {
          operation: 'createSession',
          availabilityStatus: availability.status,
        },
      )
    }

    if (config?.instructions !== undefined && config.transcript !== undefined) {
      throw new AppleAIError(
        'INVALID_SESSION_OPTIONS',
        'A session cannot start from both instructions and a transcript',
        { operation: 'createSession' },
      )
    }

    try {
      this.session = LanguageModelSessionFactory.create({
        instructions: config?.instructions,
        transcript: config?.transcript,
        tools: config?.tools,
        useCase: config?.useCase,
        guardrails: config?.guardrails,
      })
    } catch (error) {
      throw parseNativeError(error, {
        fallbackCode: 'SESSION_INITIALIZATION_ERROR',
        operation: 'createSession',
      })
    }
  }

  /**
   * Generates a complete response from the language model and resolves when finished.
   *
   * With a `schema`, the model is constrained to the Zod object schema and the
   * promise resolves with the parsed value. A value that does not parse rejects
   * with a `RESPONSE_VALIDATION_ERROR` whose `details.issues` holds the Zod issues.
   * A schema the model cannot use rejects with a `SCHEMA_CREATION_ERROR` before
   * the request reaches the model.
   *
   * Invalid `options` reject with an `INVALID_GENERATION_OPTIONS` error before
   * the request reaches the model.
   *
   * @example
   * ```typescript
   * const answer = await session.respond('Name a color', {
   *   samplingMode: { kind: 'greedy' },
   *   maximumResponseTokens: 20,
   * })
   *
   * const recipe = await session.respond('A quick pasta recipe', {
   *   schema: z.object({ title: z.string(), ingredients: z.array(z.string()) }),
   * })
   * ```
   */
  respond<S extends ObjectSchema>(
    prompt: string,
    options: StructuredGenerationOptions<S>,
  ): Promise<z.infer<S>>
  respond(prompt: string, options?: GenerationOptions): Promise<string>
  async respond(
    prompt: string,
    options?: Partial<StructuredGenerationOptions<ObjectSchema>>,
  ): Promise<unknown> {
    try {
      const request = responseRequest(options)
      return request.parse(
        await this.session.respond(prompt, request.schema, request.options),
      )
    } catch (error) {
      throw parseNativeError(error, {
        fallbackCode: 'SESSION_RESPONSE_ERROR',
        operation: 'respond',
      })
    }
  }

  /**
   * Streams a response from the language model. `onChunk` receives the full
   * response so far each time it grows.
   *
   * With a `schema`, `onChunk` receives the partial object generated so far and
   * the promise resolves with the value parsed by the schema. Partial objects
   * are not validated.
   *
   * Invalid `options` reject with an `INVALID_GENERATION_OPTIONS` error before
   * the request reaches the model.
   *
   * @example
   * ```typescript
   * await session.streamResponse('Write a haiku', setText, { temperature: 0.2 })
   *
   * const recipe = await session.streamResponse('A quick pasta recipe', setDraft, {
   *   schema: Recipe,
   * })
   * ```
   */
  streamResponse<S extends ObjectSchema>(
    prompt: string,
    onChunk: (partial: DeepPartial<z.input<S>>) => void,
    options: StructuredGenerationOptions<S>,
  ): Promise<z.infer<S>>
  streamResponse(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: GenerationOptions,
  ): Promise<string>
  async streamResponse<Chunk>(
    prompt: string,
    onChunk: (chunk: Chunk) => void,
    options?: Partial<StructuredGenerationOptions<ObjectSchema>>,
  ): Promise<unknown> {
    try {
      const request = responseRequest(options)
      let streamFailure: AppleAIError | undefined

      const emit = (raw: string) => {
        if (streamFailure) {
          return
        }

        let chunk: Chunk
        try {
          chunk = request.decodeChunk(raw) as Chunk
        } catch (error) {
          streamFailure = parseNativeError(error)
          return
        }

        try {
          onChunk(chunk)
        } catch (error) {
          // Nitro dispatches void callbacks asynchronously and cannot propagate
          // their exceptions back to this promise. Capture the first exception so
          // it cannot escape as an uncaught native C++ runtime error.
          const callbackCause = parseNativeError(error)
          streamFailure = new AppleAIError(
            'STREAM_CALLBACK_ERROR',
            `Streaming callback failed: ${callbackCause.message}`,
            {
              operation: 'streamResponse.onChunk',
              causeCode: callbackCause.code,
            },
            { cause: error },
          )
        }
      }

      const response = await this.session.streamResponse(
        prompt,
        emit,
        request.schema,
        request.options,
      )

      if (streamFailure) {
        throw streamFailure
      }

      return request.parse(response)
    } catch (error) {
      throw parseNativeError(error, {
        fallbackCode: 'SESSION_STREAMING_ERROR',
        operation: 'streamResponse',
      })
    }
  }

  /**
   * Returns the number of tokens the provided prompt consumes for this session's model.
   *
   * Note: This API is only available on iOS 26.4 or later. On earlier versions
   * the returned promise will reject with an `UNSUPPORTED_PLATFORM` error.
   */
  async tokenCount(prompt: string): Promise<number> {
    try {
      return await this.session.tokenCount(prompt)
    } catch (error) {
      throw parseNativeError(error, {
        fallbackCode: 'TOKEN_COUNT_ERROR',
        operation: 'tokenCount',
      })
    }
  }

  get wasContextReset(): boolean {
    return this.session.wasContextReset
  }

  /**
   * The session's conversation so far, including its instructions. Pass it to
   * `new LanguageModelSession({ transcript })` to continue the conversation in
   * a new session, for example after the app restarts.
   *
   * After a context overflow the session is replaced by a summarized one, and
   * this reads the replacement's transcript.
   *
   * @example
   * ```typescript
   * await storage.set('chat', session.transcript)
   *
   * const saved = (await storage.get('chat')) as SerializedTranscript
   * const restored = new LanguageModelSession({ transcript: saved, tools })
   * ```
   */
  get transcript(): SerializedTranscript {
    try {
      return this.session.serializeTranscript() as SerializedTranscript
    } catch (error) {
      throw parseNativeError(error, {
        fallbackCode: 'TRANSCRIPT_ENCODING_ERROR',
        operation: 'transcript',
      })
    }
  }

  /**
   * Asks the system to load the model resources for this session before the
   * first request, so the first response can start sooner. Call it when a
   * request is likely soon, such as when a chat screen opens. `promptPrefix`
   * is the expected start of the next prompt, when known.
   *
   * @example
   * ```typescript
   * const session = new LanguageModelSession({ instructions })
   * session.prewarm()
   * ```
   */
  prewarm(promptPrefix?: string): void {
    try {
      this.session.prewarm(promptPrefix)
    } catch (error) {
      throw parseNativeError(error, { operation: 'prewarm' })
    }
  }
}
