import Foundation
import FoundationModels

private struct UnrecognizedError: Error {}

private func code(_ error: any Error, during operation: GenerationOperation = .response) -> String {
    AppleAIError(generationFailure: error, during: operation).code
}

@main
struct GenerationFailureTests {
    static func main() {
        let context = LanguageModelSession.GenerationError.Context(debugDescription: "test")

        precondition(code(UnrecognizedError(), during: .response) == "SESSION_RESPONSE_ERROR")
        precondition(code(UnrecognizedError(), during: .streaming) == "SESSION_STREAMING_ERROR")
        precondition(code(AppleAIError.sessionBusy) == "SESSION_BUSY")

        guard case .contextExceeded = AppleAIError(
            generationFailure: LanguageModelSession.GenerationError.exceededContextWindowSize(context),
            during: .response
        ) else {
            preconditionFailure("GenerationError.exceededContextWindowSize must drive context recovery")
        }

        #if compiler(>=6.4)
        if #available(macOS 27.0, *) {
            guard case .contextExceeded = AppleAIError(
                generationFailure: LanguageModelError.contextSizeExceeded(
                    .init(contextSize: 4096, tokenCount: 5000, debugDescription: "test")
                ),
                during: .streaming
            ) else {
                preconditionFailure("LanguageModelError.contextSizeExceeded must drive context recovery")
            }

            let equivalents: [(deprecated: any Error, typed: any Error)] = [
                (
                    LanguageModelSession.GenerationError.guardrailViolation(context),
                    LanguageModelError.guardrailViolation(.init(debugDescription: "test"))
                ),
                (
                    LanguageModelSession.GenerationError.refusal(.init(transcriptEntries: []), context),
                    LanguageModelError.refusal(.init(explanation: "test", debugDescription: "test"))
                ),
                (
                    LanguageModelSession.GenerationError.rateLimited(context),
                    LanguageModelError.rateLimited(.init(resetDate: nil, debugDescription: "test"))
                ),
                (
                    LanguageModelSession.GenerationError.unsupportedGuide(context),
                    LanguageModelError.unsupportedGenerationGuide(.init(schemaName: nil, debugDescription: "test"))
                ),
                (
                    LanguageModelSession.GenerationError.unsupportedLanguageOrLocale(context),
                    LanguageModelError.unsupportedLanguageOrLocale(.init(languageCode: "xx", debugDescription: "test"))
                ),
                (
                    LanguageModelSession.GenerationError.concurrentRequests(context),
                    LanguageModelSession.Error.concurrentRequests
                ),
                (
                    LanguageModelSession.GenerationError.assetsUnavailable(context),
                    SystemLanguageModel.Error.assetsUnavailable(.init(debugDescription: "test"))
                ),
                (
                    LanguageModelSession.GenerationError.decodingFailure(context),
                    GeneratedContent.ParsingError(rawContent: "{", debugDescription: "test")
                ),
            ]
            for (deprecated, typed) in equivalents {
                precondition(
                    code(deprecated) == code(typed),
                    "\(type(of: typed)) maps to \(code(typed)), but its iOS 26 equivalent maps to \(code(deprecated))"
                )
            }

            precondition(code(LanguageModelError.timeout(.init(debugDescription: "test"))) == "TIMEOUT")
            precondition(
                code(LanguageModelError.unsupportedCapability(.init(capability: .reasoning, debugDescription: "test")))
                    == "UNSUPPORTED_CAPABILITY"
            )
            precondition(
                code(LanguageModelError.unsupportedTranscriptContent(.init(unsupportedContent: [], debugDescription: "test")))
                    == "UNSUPPORTED_TRANSCRIPT_CONTENT"
            )
        }
        #endif

        print("GenerationFailureTests passed")
    }
}
