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
