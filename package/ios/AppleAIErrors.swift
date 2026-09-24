import Foundation

public enum AppleAIError: Error, LocalizedError, CustomStringConvertible {
    case sessionBusy
    case modelUnavailable(String)
    case toolCallError(Error)
    case toolExecutionError(String, Error)
    case schemaCreationError(String)
    case argumentParsingError(String)
    case responseParsingError(String)
    case unknownToolError(String)
    case sessionStreamingError(Error)
    case sessionResponseError(Error)
    case generationError(GenerationFailureCode, message: String)
    case contextExceeded
    case contextRecoveryFailed(Error)
    case unsupportedPlatform(String)
    case tokenCountError(Error)
    case invalidGenerationOptions(String)
    case invalidTranscript(String)
    case transcriptEncodingError(Error)
    
    public var errorDescription: String? {
        switch self {
        case .sessionBusy:
            return "Another language model request is already in progress for this session"
        case .modelUnavailable(let reason):
            return "Foundation Models became unavailable: \(reason)"
        case .toolCallError(let error):
            return "Tool call failed: \(error.localizedDescription)"
        case .toolExecutionError(let toolName, let error):
            return "Tool '\(toolName)' execution failed: \(error.localizedDescription)"
        case .schemaCreationError(let details):
            return "Failed to create schema: \(details)"
        case .argumentParsingError(let details):
            return "Failed to parse tool arguments: \(details)"
        case .responseParsingError(let details):
            return "Failed to parse tool response: \(details)"
        case .unknownToolError(let toolName):
            return "Unknown tool: \(toolName)"
        case .sessionStreamingError(let error):
            return "Session streaming failed: \(error.localizedDescription)"
        case .sessionResponseError(let error):
            return "Session response failed: \(error.localizedDescription)"
        case .generationError(_, let message):
            return message
        case .contextExceeded:
            return "Context window size exceeded, session recreated with conversation summary"
        case .contextRecoveryFailed(let error):
            return "Context window size exceeded and session recovery failed: \(error.localizedDescription)"
        case .unsupportedPlatform(let message):
            return message
        case .tokenCountError(let error):
            return "Token count failed: \(error.localizedDescription)"
        case .invalidGenerationOptions(let details):
            return "Invalid generation options: \(details)"
        case .invalidTranscript(let details):
            return "Invalid transcript: \(details)"
        case .transcriptEncodingError(let error):
            return "Failed to encode transcript: \(error.localizedDescription)"
        }
    }
    
    public var description: String {
        return "[\(code)] \(errorDescription ?? "Unknown AppleAI error")"
    }
    
    public var code: String {
        switch self {
        case .sessionBusy:
            return "SESSION_BUSY"
        case .modelUnavailable:
            return "MODEL_UNAVAILABLE"
        case .toolCallError:
            return "TOOL_CALL_ERROR"
        case .toolExecutionError:
            return "TOOL_EXECUTION_ERROR"
        case .schemaCreationError:
            return "SCHEMA_CREATION_ERROR"
        case .argumentParsingError:
            return "ARGUMENT_PARSING_ERROR"
        case .responseParsingError:
            return "RESPONSE_PARSING_ERROR"
        case .unknownToolError:
            return "UNKNOWN_TOOL_ERROR"
        case .sessionStreamingError:
            return "SESSION_STREAMING_ERROR"
        case .sessionResponseError:
            return "SESSION_RESPONSE_ERROR"
        case .generationError(let code, _):
            return code.rawValue
        case .contextExceeded:
            return "CONTEXT_EXCEEDED"
        case .contextRecoveryFailed:
            return "CONTEXT_RECOVERY_FAILED"
        case .unsupportedPlatform:
            return "UNSUPPORTED_PLATFORM"
        case .tokenCountError:
            return "TOKEN_COUNT_ERROR"
        case .invalidGenerationOptions:
            return "INVALID_GENERATION_OPTIONS"
        case .invalidTranscript:
            return "INVALID_TRANSCRIPT"
        case .transcriptEncodingError:
            return "TRANSCRIPT_ENCODING_ERROR"
        }
    }
}

public enum GenerationFailureCode: String {
    case assetsUnavailable = "ASSETS_UNAVAILABLE"
    case guardrailViolation = "GUARDRAIL_VIOLATION"
    case unsupportedGuide = "UNSUPPORTED_GUIDE"
    case unsupportedLanguageOrLocale = "UNSUPPORTED_LANGUAGE_OR_LOCALE"
    case unsupportedCapability = "UNSUPPORTED_CAPABILITY"
    case unsupportedTranscriptContent = "UNSUPPORTED_TRANSCRIPT_CONTENT"
    case decodingFailure = "DECODING_FAILURE"
    case rateLimited = "RATE_LIMITED"
    case refusal = "REFUSAL"
    case timeout = "TIMEOUT"
    case generic = "GENERATION_ERROR"
}
