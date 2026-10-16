import Foundation
import FoundationModels

enum ModelOperation: String {
    case response
    case streaming
}

enum FoundationModelsFailure {
    case contextOverflow
    case other(AppleAIError)
}

private enum GenerationFailure: String {
    case assetsUnavailable = "ASSETS_UNAVAILABLE"
    case guardrailViolation = "GUARDRAIL_VIOLATION"
    case refusal = "REFUSAL"
    case rateLimited = "RATE_LIMITED"
    case sessionBusy = "SESSION_BUSY"
    case transcriptMutationWhileResponding = "TRANSCRIPT_MUTATION_WHILE_RESPONDING"
    case decodingFailure = "DECODING_FAILURE"
    case unsupportedGuide = "UNSUPPORTED_GUIDE"
    case unsupportedLanguageOrLocale = "UNSUPPORTED_LANGUAGE_OR_LOCALE"
    case unsupportedCapability = "UNSUPPORTED_CAPABILITY"
    case unsupportedTranscriptContent = "UNSUPPORTED_TRANSCRIPT_CONTENT"
    case timeout = "TIMEOUT"
    case unknown = "GENERATION_ERROR"

    func error(during operation: ModelOperation, _ detail: String) -> FoundationModelsFailure {
        .other(.generationError(code: rawValue, message: "\(summary(operation.rawValue)): \(detail)"))
    }

    private func summary(_ operation: String) -> String {
        switch self {
        case .assetsUnavailable:
            return "Model assets are unavailable during \(operation)"
        case .guardrailViolation:
            return "The request violated model guardrails during \(operation)"
        case .refusal:
            return "The model refused the \(operation) request"
        case .rateLimited:
            return "The model rate-limited the \(operation) request"
        case .sessionBusy:
            return "Another language model request was already in progress"
        case .transcriptMutationWhileResponding:
            return "The session transcript was modified while a \(operation) request was in progress"
        case .decodingFailure:
            return "The model response could not be decoded during \(operation)"
        case .unsupportedGuide:
            return "The request used an unsupported generation guide during \(operation)"
        case .unsupportedLanguageOrLocale:
            return "The request used an unsupported language or locale during \(operation)"
        case .unsupportedCapability:
            return "The model does not support a capability required during \(operation)"
        case .unsupportedTranscriptContent:
            return "The transcript contains content the model does not support during \(operation)"
        case .timeout:
            return "The model timed out during \(operation)"
        case .unknown:
            return "Model generation failed during \(operation)"
        }
    }
}

@available(iOS 26.0, macOS 26.0, *)
func mapFoundationModelsError(_ error: Error, during operation: ModelOperation) -> FoundationModelsFailure {
    if let error = error as? AppleAIError {
        return .other(error)
    }

    if let error = error as? LanguageModelSession.ToolCallError {
        return .other(error.underlyingError as? AppleAIError ?? .toolCallError(error.underlyingError))
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
        return .other(.sessionResponseError(error))
    case .streaming:
        return .other(.sessionStreamingError(error))
    }
}

#if compiler(>=6.4)
@available(iOS 27.0, macOS 27.0, *)
private func mapTypedError(_ error: Error, during operation: ModelOperation) -> FoundationModelsFailure? {
    switch error {
    case let error as LanguageModelError:
        return mapLanguageModelError(error, during: operation)
    case let error as LanguageModelSession.Error:
        switch error {
        case .concurrentRequests:
            return GenerationFailure.sessionBusy.error(during: operation, error.debugDescription)
        case .transcriptMutationWhileResponding:
            return GenerationFailure.transcriptMutationWhileResponding.error(during: operation, error.debugDescription)
        @unknown default:
            return GenerationFailure.unknown.error(during: operation, error.localizedDescription)
        }
    case let error as SystemLanguageModel.Error:
        switch error {
        case .assetsUnavailable(let context):
            return GenerationFailure.assetsUnavailable.error(during: operation, context.debugDescription)
        @unknown default:
            return GenerationFailure.unknown.error(during: operation, error.localizedDescription)
        }
    case let error as GeneratedContent.ParsingError:
        return GenerationFailure.decodingFailure.error(during: operation, error.debugDescription)
    default:
        return nil
    }
}

@available(iOS 27.0, macOS 27.0, *)
private func mapLanguageModelError(
    _ error: LanguageModelError,
    during operation: ModelOperation
) -> FoundationModelsFailure {
    switch error {
    case .contextSizeExceeded:
        return .contextOverflow
    case .rateLimited(let context):
        return GenerationFailure.rateLimited.error(during: operation, context.debugDescription)
    case .guardrailViolation(let context):
        return GenerationFailure.guardrailViolation.error(during: operation, context.debugDescription)
    case .refusal(let context):
        return GenerationFailure.refusal.error(during: operation, context.debugDescription)
    case .unsupportedCapability(let context):
        return GenerationFailure.unsupportedCapability.error(during: operation, context.debugDescription)
    case .unsupportedTranscriptContent(let context):
        return GenerationFailure.unsupportedTranscriptContent.error(during: operation, context.debugDescription)
    case .unsupportedGenerationGuide(let context):
        return GenerationFailure.unsupportedGuide.error(during: operation, context.debugDescription)
    case .unsupportedLanguageOrLocale(let context):
        return GenerationFailure.unsupportedLanguageOrLocale.error(during: operation, context.debugDescription)
    case .timeout(let context):
        return GenerationFailure.timeout.error(during: operation, context.debugDescription)
    @unknown default:
        return GenerationFailure.unknown.error(during: operation, error.localizedDescription)
    }
}
#endif

@available(iOS 26.0, macOS 26.0, *)
private func mapGenerationError(
    _ error: LanguageModelSession.GenerationError,
    during operation: ModelOperation
) -> FoundationModelsFailure {
    switch error {
    case .exceededContextWindowSize:
        return .contextOverflow
    case .assetsUnavailable(let context):
        return GenerationFailure.assetsUnavailable.error(during: operation, context.debugDescription)
    case .guardrailViolation(let context):
        return GenerationFailure.guardrailViolation.error(during: operation, context.debugDescription)
    case .unsupportedGuide(let context):
        return GenerationFailure.unsupportedGuide.error(during: operation, context.debugDescription)
    case .unsupportedLanguageOrLocale(let context):
        return GenerationFailure.unsupportedLanguageOrLocale.error(during: operation, context.debugDescription)
    case .decodingFailure(let context):
        return GenerationFailure.decodingFailure.error(during: operation, context.debugDescription)
    case .rateLimited(let context):
        return GenerationFailure.rateLimited.error(during: operation, context.debugDescription)
    case .concurrentRequests(let context):
        return GenerationFailure.sessionBusy.error(during: operation, context.debugDescription)
    case .refusal(_, let context):
        return GenerationFailure.refusal.error(during: operation, context.debugDescription)
    @unknown default:
        return GenerationFailure.unknown.error(during: operation, error.localizedDescription)
    }
}
