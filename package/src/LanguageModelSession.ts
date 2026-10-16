import { Platform } from 'react-native'
import { NitroModules } from 'react-native-nitro-modules'
import { AppleAIError, parseNativeError } from './errors'
import { toNativeGenerationOptions } from './generation-options'
import type {
  LanguageModelSessionConfig,
  LanguageModelSessionFactory as LanguageModelSessionFactorySpec,
  LanguageModelSession as LanguageModelSessionSpec,
} from './specs/LanguageModelSession.nitro'
import type {
  AvailabilityStatus,
  FoundationModelsAvailability,
  FoundationModelsModelFamily,
  GenerationOptions,
  SystemLanguageModelGuardrails,
  SystemLanguageModelUseCase,
} from './types'

const LanguageModelSessionFactory =
  NitroModules.createHybridObject<LanguageModelSessionFactorySpec>(
    'LanguageModelSessionFactory',
  )

export interface LanguageModelSessionOptions
  extends Omit<LanguageModelSessionConfig, 'useCase' | 'guardrails'> {
  useCase?: SystemLanguageModelUseCase
  guardrails?: SystemLanguageModelGuardrails
}

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

    try {
      this.session = LanguageModelSessionFactory.create({
        instructions: config?.instructions,
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
   * Invalid `options` reject with an `INVALID_GENERATION_OPTIONS` error before
   * the request reaches the model.
   *
   * @example
   * ```typescript
   * const answer = await session.respond('Name a color', {
   *   samplingMode: { kind: 'greedy' },
   *   maximumResponseTokens: 20,
   * })
   * ```
   */
  async respond(prompt: string, options?: GenerationOptions): Promise<string> {
    try {
      return await this.session.respond(prompt, toNativeGenerationOptions(options))
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
   * Invalid `options` reject with an `INVALID_GENERATION_OPTIONS` error before
   * the request reaches the model.
   *
   * @example
   * ```typescript
   * await session.streamResponse('Write a haiku', setText, { temperature: 0.2 })
   * ```
   */
  async streamResponse(
    prompt: string,
    onChunk: (chunk: string) => void,
    options?: GenerationOptions,
  ): Promise<string> {
    let callbackError: unknown
    let callbackDidFail = false

    const safeOnChunk = (chunk: string) => {
      if (callbackDidFail) {
        return
      }

      try {
        onChunk(chunk)
      } catch (error) {
        // Nitro dispatches void callbacks asynchronously and cannot propagate
        // their exceptions back to this promise. Capture the first exception so
        // it cannot escape as an uncaught native C++ runtime error.
        callbackDidFail = true
        callbackError = error
      }
    }

    try {
      const response = await this.session.streamResponse(
        prompt,
        safeOnChunk,
        toNativeGenerationOptions(options),
      )

      if (callbackDidFail) {
        const callbackCause = parseNativeError(callbackError)
        throw new AppleAIError(
          'STREAM_CALLBACK_ERROR',
          `Streaming callback failed: ${callbackCause.message}`,
          {
            operation: 'streamResponse.onChunk',
            causeCode: callbackCause.code,
          },
          { cause: callbackError },
        )
      }

      return response
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
}
