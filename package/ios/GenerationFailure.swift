import FoundationModels

enum GenerationOperation: String {
    case response
    case streaming
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

    private static func unmapped(_ error: any Error, during operation: GenerationOperation) -> AppleAIError {
        switch operation {
        case .response:
            return .sessionResponseError(error)
        case .streaming:
            return .sessionStreamingError(error)
        }
    }

    private static func mappingTypedError(_ error: any Error, during operation: GenerationOperation) -> AppleAIError? {
        #if compiler(>=6.4)
        guard #available(iOS 27.0, macOS 27.0, *) else { return nil }
        switch error {
        case let error as LanguageModelError:
            return mapping(error, during: operation)
        case let error as LanguageModelSession.Error:
            return mapping(error)
        case let error as SystemLanguageModel.Error:
            return mapping(error, during: operation)
        case let error as GeneratedContent.ParsingError:
            return .generationError(
                code: "DECODING_FAILURE",
                message: "The model response could not be parsed during \(operation.rawValue): \(error.debugDescription)"
            )
        default:
            return nil
        }
        #else
        return nil
        #endif
    }

    private static func mapping(
        _ error: LanguageModelSession.GenerationError,
        during operation: GenerationOperation
    ) -> AppleAIError {
        let operation = operation.rawValue
        switch error {
        case .exceededContextWindowSize:
            return .contextExceeded
        case .assetsUnavailable(let context):
            return .generationError(
                code: "ASSETS_UNAVAILABLE",
                message: "Model assets are unavailable during \(operation): \(context.debugDescription)"
            )
        case .guardrailViolation(let context):
            return .generationError(
                code: "GUARDRAIL_VIOLATION",
                message: "The request violated model guardrails during \(operation): \(context.debugDescription)"
            )
        case .unsupportedGuide(let context):
            return .generationError(
                code: "UNSUPPORTED_GUIDE",
                message: "The request used an unsupported generation guide during \(operation): \(context.debugDescription)"
            )
        case .unsupportedLanguageOrLocale(let context):
            return .generationError(
                code: "UNSUPPORTED_LANGUAGE_OR_LOCALE",
                message: "The request used an unsupported language or locale during \(operation): \(context.debugDescription)"
            )
        case .decodingFailure(let context):
            return .generationError(
                code: "DECODING_FAILURE",
                message: "The model response could not be decoded during \(operation): \(context.debugDescription)"
            )
        case .rateLimited(let context):
            return .generationError(
                code: "RATE_LIMITED",
                message: "The model rate-limited the \(operation) request: \(context.debugDescription)"
            )
        case .concurrentRequests(let context):
            return .generationError(
                code: "SESSION_BUSY",
                message: "Another language model request was already in progress: \(context.debugDescription)"
            )
        case .refusal(_, let context):
            return .generationError(
                code: "REFUSAL",
                message: "The model refused the \(operation) request: \(context.debugDescription)"
            )
        @unknown default:
            return .generationError(
                code: "GENERATION_ERROR",
                message: "Model generation failed during \(operation): \(error.localizedDescription)"
            )
        }
    }

    #if compiler(>=6.4)
    @available(iOS 27.0, macOS 27.0, *)
    private static func mapping(_ error: LanguageModelError, during operation: GenerationOperation) -> AppleAIError {
        let operation = operation.rawValue
        switch error {
        case .contextSizeExceeded:
            return .contextExceeded
        case .rateLimited(let details):
            return .generationError(
                code: "RATE_LIMITED",
                message: "The model rate-limited the \(operation) request: \(details.debugDescription)"
            )
        case .guardrailViolation(let details):
            return .generationError(
                code: "GUARDRAIL_VIOLATION",
                message: "The request violated model guardrails during \(operation): \(details.debugDescription)"
            )
        case .refusal(let details):
            return .generationError(
                code: "REFUSAL",
                message: "The model refused the \(operation) request: \(details.debugDescription)"
            )
        case .unsupportedCapability(let details):
            return .generationError(
                code: "UNSUPPORTED_CAPABILITY",
                message: "The model does not support a capability the \(operation) request needs: \(details.debugDescription)"
            )
        case .unsupportedTranscriptContent(let details):
            return .generationError(
                code: "UNSUPPORTED_TRANSCRIPT_CONTENT",
                message: "The session transcript has content the model does not support during \(operation): \(details.debugDescription)"
            )
        case .unsupportedGenerationGuide(let details):
            return .generationError(
                code: "UNSUPPORTED_GUIDE",
                message: "The request used an unsupported generation guide during \(operation): \(details.debugDescription)"
            )
        case .unsupportedLanguageOrLocale(let details):
            return .generationError(
                code: "UNSUPPORTED_LANGUAGE_OR_LOCALE",
                message: "The request used an unsupported language or locale during \(operation): \(details.debugDescription)"
            )
        case .timeout(let details):
            return .generationError(
                code: "TIMEOUT",
                message: "The \(operation) request timed out: \(details.debugDescription)"
            )
        @unknown default:
            return .generationError(
                code: "GENERATION_ERROR",
                message: "Model generation failed during \(operation): \(error.localizedDescription)"
            )
        }
    }

    @available(iOS 27.0, macOS 27.0, *)
    private static func mapping(_ error: LanguageModelSession.Error) -> AppleAIError {
        switch error {
        case .concurrentRequests, .transcriptMutationWhileResponding:
            return .generationError(
                code: "SESSION_BUSY",
                message: "The session is busy with another request: \(error.debugDescription)"
            )
        @unknown default:
            return .generationError(
                code: "GENERATION_ERROR",
                message: "The session rejected the request: \(error.debugDescription)"
            )
        }
    }

    @available(iOS 27.0, macOS 27.0, *)
    private static func mapping(_ error: SystemLanguageModel.Error, during operation: GenerationOperation) -> AppleAIError {
        switch error {
        case .assetsUnavailable(let details):
            return .generationError(
                code: "ASSETS_UNAVAILABLE",
                message: "Model assets are unavailable during \(operation.rawValue): \(details.debugDescription)"
            )
        @unknown default:
            return .generationError(
                code: "GENERATION_ERROR",
                message: "The model failed during \(operation.rawValue): \(error.debugDescription)"
            )
        }
    }
    #endif
}
