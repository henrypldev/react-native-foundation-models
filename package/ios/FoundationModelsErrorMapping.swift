import Foundation
import FoundationModels

enum ModelOperation: String {
    case response
    case streaming
}

@available(iOS 26.0, macOS 26.0, *)
func mapFoundationModelsError(_ error: Error, during operation: ModelOperation) -> AppleAIError {
    if let error = error as? AppleAIError {
        return error
    }

    if let error = error as? LanguageModelSession.ToolCallError {
        return error.underlyingError as? AppleAIError ?? .toolCallError(error.underlyingError)
    }

    #if compiler(>=6.4)
    if #available(iOS 27.0, macOS 27.0, *), let mapped = mapTypedError(error, during: operation) {
        return mapped
    }
    #endif

    if let error = error as? LanguageModelSession.GenerationError {
        return mapGenerationError(error, during: operation)
    }

    switch operation {
    case .response:
        return .sessionResponseError(error)
    case .streaming:
        return .sessionStreamingError(error)
    }
}

#if compiler(>=6.4)
@available(iOS 27.0, macOS 27.0, *)
private func mapTypedError(_ error: Error, during operation: ModelOperation) -> AppleAIError? {
    switch error {
    case let error as LanguageModelError:
        return mapLanguageModelError(error, during: operation)
    case let error as LanguageModelSession.Error:
        switch error {
        case .concurrentRequests, .transcriptMutationWhileResponding:
            return .generationError(
                code: "SESSION_BUSY",
                message: "Another language model request was already in progress: \(error.debugDescription)"
            )
        @unknown default:
            return nil
        }
    case let error as SystemLanguageModel.Error:
        switch error {
        case .assetsUnavailable(let context):
            return .generationError(
                code: "ASSETS_UNAVAILABLE",
                message: "Model assets are unavailable during \(operation.rawValue): \(context.debugDescription)"
            )
        @unknown default:
            return nil
        }
    case let error as GeneratedContent.ParsingError:
        return .generationError(
            code: "DECODING_FAILURE",
            message: "The model response could not be decoded during \(operation.rawValue): \(error.debugDescription)"
        )
    default:
        return nil
    }
}

@available(iOS 27.0, macOS 27.0, *)
private func mapLanguageModelError(_ error: LanguageModelError, during operation: ModelOperation) -> AppleAIError? {
    let operation = operation.rawValue
    switch error {
    case .contextSizeExceeded:
        return .contextExceeded
    case .rateLimited(let context):
        return .generationError(
            code: "RATE_LIMITED",
            message: "The model rate-limited the \(operation) request: \(context.debugDescription)"
        )
    case .guardrailViolation(let context):
        return .generationError(
            code: "GUARDRAIL_VIOLATION",
            message: "The request violated model guardrails during \(operation): \(context.debugDescription)"
        )
    case .refusal(let context):
        return .generationError(
            code: "REFUSAL",
            message: "The model refused the \(operation) request: \(context.debugDescription)"
        )
    case .unsupportedCapability(let context):
        return .generationError(
            code: "UNSUPPORTED_CAPABILITY",
            message: "The model does not support a capability required during \(operation): \(context.debugDescription)"
        )
    case .unsupportedTranscriptContent(let context):
        return .generationError(
            code: "UNSUPPORTED_TRANSCRIPT_CONTENT",
            message: "The transcript contains content the model does not support during \(operation): \(context.debugDescription)"
        )
    case .unsupportedGenerationGuide(let context):
        return .generationError(
            code: "UNSUPPORTED_GUIDE",
            message: "The request used an unsupported generation guide during \(operation): \(context.debugDescription)"
        )
    case .unsupportedLanguageOrLocale(let context):
        return .generationError(
            code: "UNSUPPORTED_LANGUAGE_OR_LOCALE",
            message: "The request used an unsupported language or locale during \(operation): \(context.debugDescription)"
        )
    case .timeout(let context):
        return .generationError(
            code: "TIMEOUT",
            message: "The model timed out during \(operation): \(context.debugDescription)"
        )
    @unknown default:
        return nil
    }
}
#endif

@available(iOS 26.0, macOS 26.0, *)
private func mapGenerationError(
    _ error: LanguageModelSession.GenerationError,
    during operation: ModelOperation
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
