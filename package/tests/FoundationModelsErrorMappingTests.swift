import Foundation
import FoundationModels

struct UnrelatedError: Error {}

@available(iOS 26.0, macOS 26.0, *)
private func expectCode(_ error: Error, _ expected: String, during operation: ModelOperation = .response) {
    let code = mapFoundationModelsError(error, during: operation).code
    precondition(code == expected, "\(type(of: error)) mapped to \(code), expected \(expected)")
}

@available(iOS 26.0, macOS 26.0, *)
private func testFallbacksKeepOperation() {
    expectCode(UnrelatedError(), "SESSION_RESPONSE_ERROR", during: .response)
    expectCode(UnrelatedError(), "SESSION_STREAMING_ERROR", during: .streaming)
    expectCode(AppleAIError.sessionBusy, "SESSION_BUSY")
}

@available(iOS 26.0, macOS 26.0, *)
private func testGenerationErrors() {
    let context = LanguageModelSession.GenerationError.Context(debugDescription: "test")
    expectCode(LanguageModelSession.GenerationError.exceededContextWindowSize(context), "CONTEXT_EXCEEDED")
    expectCode(LanguageModelSession.GenerationError.guardrailViolation(context), "GUARDRAIL_VIOLATION")
    expectCode(LanguageModelSession.GenerationError.rateLimited(context), "RATE_LIMITED")
}

@available(iOS 27.0, macOS 27.0, *)
private func testLanguageModelErrors() {
    expectCode(
        LanguageModelError.contextSizeExceeded(.init(contextSize: 4096, tokenCount: 20057, debugDescription: "test")),
        "CONTEXT_EXCEEDED",
        during: .streaming
    )
    expectCode(LanguageModelError.rateLimited(.init(resetDate: nil, debugDescription: "test")), "RATE_LIMITED")
    expectCode(LanguageModelError.guardrailViolation(.init(debugDescription: "test")), "GUARDRAIL_VIOLATION")
    expectCode(LanguageModelError.refusal(.init(explanation: "no", debugDescription: "test")), "REFUSAL")
    expectCode(
        LanguageModelError.unsupportedCapability(.init(capability: .vision, debugDescription: "test")),
        "UNSUPPORTED_CAPABILITY"
    )
    expectCode(
        LanguageModelError.unsupportedTranscriptContent(.init(unsupportedContent: [], debugDescription: "test")),
        "UNSUPPORTED_TRANSCRIPT_CONTENT"
    )
    expectCode(
        LanguageModelError.unsupportedGenerationGuide(.init(schemaName: nil, debugDescription: "test")),
        "UNSUPPORTED_GUIDE"
    )
    expectCode(
        LanguageModelError.unsupportedLanguageOrLocale(.init(languageCode: "xx", debugDescription: "test")),
        "UNSUPPORTED_LANGUAGE_OR_LOCALE"
    )
    expectCode(LanguageModelError.timeout(.init(debugDescription: "test")), "TIMEOUT")
    expectCode(LanguageModelSession.Error.concurrentRequests, "SESSION_BUSY")
    expectCode(SystemLanguageModel.Error.assetsUnavailable(.init(debugDescription: "test")), "ASSETS_UNAVAILABLE")
    expectCode(GeneratedContent.ParsingError(rawContent: "", debugDescription: "test"), "DECODING_FAILURE")
}

@main
struct FoundationModelsErrorMappingTests {
    static func main() {
        guard #available(iOS 26.0, macOS 26.0, *) else { return }
        testFallbacksKeepOperation()
        testGenerationErrors()
        if #available(iOS 27.0, macOS 27.0, *) {
            testLanguageModelErrors()
        }
        print("FoundationModelsErrorMappingTests passed")
    }
}
