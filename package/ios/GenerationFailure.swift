import FoundationModels

enum GenerationOperation: String {
    case response
    case streaming
}

extension GenerationFailureCode {
    var summary: String {
        switch self {
        case .assetsUnavailable: "Model assets are unavailable"
        case .guardrailViolation: "The request violated model guardrails"
        case .unsupportedGuide: "The request used an unsupported generation guide"
        case .unsupportedLanguageOrLocale: "The request used an unsupported language or locale"
        case .unsupportedCapability: "The model does not support a capability the request needs"
        case .unsupportedTranscriptContent: "The session transcript has content the model does not support"
        case .decodingFailure: "The model response could not be decoded"
        case .rateLimited: "The model rate-limited the request"
        case .refusal: "The model refused the request"
        case .timeout: "The request timed out"
        case .generic: "Model generation failed"
        }
    }
}

@available(iOS 26.0, macOS 26.0, *)
extension AppleAIError {
    init(generationFailure error: any Error, during operation: GenerationOperation) {
        switch error {
        case let error as AppleAIError:
            self = error
        case let error as LanguageModelSession.ToolCallError:
            self = error.underlyingError as? AppleAIError ?? .toolCallError(error.underlyingError)
        case let error as LanguageModelSession.GenerationError:
            self = Self.mapping(error, during: operation)
        default:
            self = Self.mappingTypedError(error, during: operation) ?? Self.unmapped(error, during: operation)
        }
    }

    static func failed(
        _ code: GenerationFailureCode,
        _ detail: String,
        during operation: GenerationOperation
    ) -> AppleAIError {
        .generationError(code, message: "\(code.summary) during \(operation.rawValue): \(detail)")
    }

    private static func unmapped(_ error: any Error, during operation: GenerationOperation) -> AppleAIError {
        switch operation {
        case .response: .sessionResponseError(error)
        case .streaming: .sessionStreamingError(error)
        }
    }

    private static func mapping(
        _ error: LanguageModelSession.GenerationError,
        during op: GenerationOperation
    ) -> AppleAIError {
        switch error {
        case .exceededContextWindowSize: .contextExceeded
        case .concurrentRequests: .sessionBusy
        case .assetsUnavailable(let c): failed(.assetsUnavailable, c.debugDescription, during: op)
        case .guardrailViolation(let c): failed(.guardrailViolation, c.debugDescription, during: op)
        case .unsupportedGuide(let c): failed(.unsupportedGuide, c.debugDescription, during: op)
        case .unsupportedLanguageOrLocale(let c): failed(.unsupportedLanguageOrLocale, c.debugDescription, during: op)
        case .decodingFailure(let c): failed(.decodingFailure, c.debugDescription, during: op)
        case .rateLimited(let c): failed(.rateLimited, c.debugDescription, during: op)
        case .refusal(_, let c): failed(.refusal, c.debugDescription, during: op)
        @unknown default: failed(.generic, error.localizedDescription, during: op)
        }
    }
}
