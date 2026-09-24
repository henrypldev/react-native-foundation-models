export interface AppleAIErrorInfo {
  code: string
  message: string
  details?: Record<string, any>
}

export interface NativeErrorContext {
  fallbackCode?: string
  operation?: string
}

const NATIVE_ERROR_PREFIX = /\[([A-Z][A-Z0-9_]*)\]\s*(.*)$/s
const STABLE_ERROR_CODE = /^[A-Z][A-Z0-9_]*$/

export class AppleAIError extends Error {
  public readonly code: string
  public readonly details?: Record<string, any>

  constructor(
    code: string,
    message: string,
    details?: Record<string, any>,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'AppleAIError'
    this.code = code
    this.details = details
  }

  static fromErrorInfo(errorInfo: AppleAIErrorInfo): AppleAIError {
    return new AppleAIError(errorInfo.code, errorInfo.message, errorInfo.details)
  }

  toErrorInfo(): AppleAIErrorInfo {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
    }
  }
}

export class SessionNotInitializedError extends AppleAIError {
  constructor(details?: Record<string, any>) {
    super('SESSION_NOT_INITIALIZED', 'Language model session is not initialized', details)
  }
}

export class ToolCallError extends AppleAIError {
  constructor(message: string, details?: Record<string, any>) {
    super('TOOL_CALL_ERROR', `Tool call failed: ${message}`, details)
  }
}

export class ToolExecutionError extends AppleAIError {
  constructor(toolName: string, message: string, details?: Record<string, any>) {
    super('TOOL_EXECUTION_ERROR', `Tool '${toolName}' execution failed: ${message}`, {
      ...details,
      toolName,
    })
  }
}

export class SchemaCreationError extends AppleAIError {
  constructor(message: string, details?: Record<string, any>) {
    super('SCHEMA_CREATION_ERROR', `Failed to create schema: ${message}`, details)
  }
}

export class ArgumentParsingError extends AppleAIError {
  constructor(message: string, details?: Record<string, any>) {
    super('ARGUMENT_PARSING_ERROR', `Failed to parse tool arguments: ${message}`, details)
  }
}

export class ResponseParsingError extends AppleAIError {
  constructor(message: string, details?: Record<string, any>) {
    super('RESPONSE_PARSING_ERROR', `Failed to parse tool response: ${message}`, details)
  }
}

export class ResponseValidationError extends AppleAIError {
  constructor(message: string, details?: Record<string, any>) {
    super(
      'RESPONSE_VALIDATION_ERROR',
      `Response does not match the schema: ${message}`,
      details,
    )
  }
}

export class UnknownToolError extends AppleAIError {
  constructor(toolName: string, details?: Record<string, any>) {
    super('UNKNOWN_TOOL_ERROR', `Unknown tool: ${toolName}`, {
      ...details,
      toolName,
    })
  }
}

export class SessionStreamingError extends AppleAIError {
  constructor(message: string, details?: Record<string, any>) {
    super('SESSION_STREAMING_ERROR', `Session streaming failed: ${message}`, details)
  }
}

export class UnsupportedPlatformError extends AppleAIError {
  constructor(
    message = 'Foundation Models requires iOS 26.0 or later',
    details?: Record<string, any>,
  ) {
    super('UNSUPPORTED_PLATFORM', message, details)
  }
}

export function isAppleAIError(error: any): error is AppleAIError {
  return (
    error instanceof AppleAIError ||
    (error?.name === 'AppleAIError' &&
      typeof error.code === 'string' &&
      typeof error.message === 'string')
  )
}

function getNativeErrorDetails(
  error: any,
  context?: NativeErrorContext,
): Record<string, any> | undefined {
  const details: Record<string, any> = {}

  if (context?.operation) {
    details.operation = context.operation
  }

  if (error && typeof error === 'object') {
    if (typeof error.name === 'string') {
      details.nativeName = error.name
    }
    if (typeof error.code === 'string' || typeof error.code === 'number') {
      details.nativeCode = error.code
    }
    if (typeof error.domain === 'string') {
      details.nativeDomain = error.domain
    }
  }

  return Object.keys(details).length > 0 ? details : undefined
}

function parseBridgeMessage(message: string): {
  code?: string
  message: string
} {
  const match = message.match(NATIVE_ERROR_PREFIX)
  if (!match) {
    return { message }
  }

  return {
    code: match[1],
    message: match[2] || message,
  }
}

export function parseNativeError(error: any, context?: NativeErrorContext): AppleAIError {
  if (error instanceof AppleAIError) {
    return error
  }

  if (isAppleAIError(error)) {
    return new AppleAIError(error.code, error.message, error.details, {
      cause: error,
    })
  }

  if (typeof error === 'string') {
    try {
      const parsed = JSON.parse(error)
      if (
        parsed &&
        typeof parsed === 'object' &&
        'code' in parsed &&
        'message' in parsed
      ) {
        return AppleAIError.fromErrorInfo(parsed)
      }
    } catch {
      // Not JSON, treat as plain error message
    }
    const parsedMessage = parseBridgeMessage(error)
    return new AppleAIError(
      parsedMessage.code ?? context?.fallbackCode ?? 'UNKNOWN_ERROR',
      parsedMessage.message,
      getNativeErrorDetails(error, context),
      { cause: error },
    )
  }

  if (error && typeof error === 'object') {
    const nativeMessage =
      (typeof error.message === 'string' && error.message) ||
      (typeof error.localizedDescription === 'string' && error.localizedDescription) ||
      'Unknown native error'
    const parsedMessage = parseBridgeMessage(nativeMessage)
    const nativeCode =
      typeof error.code === 'string' && STABLE_ERROR_CODE.test(error.code)
        ? error.code
        : undefined

    return new AppleAIError(
      parsedMessage.code ?? nativeCode ?? context?.fallbackCode ?? 'UNKNOWN_ERROR',
      parsedMessage.message,
      getNativeErrorDetails(error, context),
      { cause: error },
    )
  }

  return new AppleAIError(
    context?.fallbackCode ?? 'UNKNOWN_ERROR',
    'An unknown error occurred',
    getNativeErrorDetails(error, context),
    { cause: error },
  )
}
