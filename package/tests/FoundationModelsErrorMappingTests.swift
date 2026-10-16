import Foundation
import FoundationModels

struct UnrelatedError: Error {}

struct EchoTool: Tool {
    let name = "echo"
    let description = "Echoes its input"
    func call(arguments: GeneratedContent) async throws -> String { "" }
}

@available(iOS 26.0, macOS 26.0, *)
private func expectCode(_ error: Error, _ expected: String, during operation: ModelOperation = .response) {
    switch mapFoundationModelsError(error, during: operation) {
    case .contextOverflow:
        preconditionFailure("\(type(of: error)) mapped to contextOverflow, expected \(expected)")
    case .other(let mapped):
        precondition(mapped.code == expected, "\(type(of: error)) mapped to \(mapped.code), expected \(expected)")
    }
}

@available(iOS 26.0, macOS 26.0, *)
private func expectContextOverflow(_ error: Error, during operation: ModelOperation = .response) {
    guard case .contextOverflow = mapFoundationModelsError(error, during: operation) else {
        preconditionFailure("\(type(of: error)) did not map to contextOverflow")
    }
}

@available(iOS 26.0, macOS 26.0, *)
private func testFallbacksKeepOperation() {
    expectCode(UnrelatedError(), "SESSION_RESPONSE_ERROR", during: .response)
    expectCode(UnrelatedError(), "SESSION_STREAMING_ERROR", during: .streaming)
}

@available(iOS 26.0, macOS 26.0, *)
private func testAppleAIErrorsPassThroughWithoutRecovery() {
    expectCode(AppleAIError.sessionBusy, "SESSION_BUSY")
    expectCode(AppleAIError.contextExceeded, "CONTEXT_EXCEEDED")
}

@available(iOS 26.0, macOS 26.0, *)
private func testToolCallErrors() {
    expectCode(
        LanguageModelSession.ToolCallError(tool: EchoTool(), underlyingError: AppleAIError.contextExceeded),
        "CONTEXT_EXCEEDED"
    )
    expectCode(
        LanguageModelSession.ToolCallError(tool: EchoTool(), underlyingError: UnrelatedError()),
        "TOOL_CALL_ERROR"
    )
}

@available(iOS 26.0, macOS 26.0, *)
private func testGenerationErrors() {
    let context = LanguageModelSession.GenerationError.Context(debugDescription: "test")
    expectContextOverflow(LanguageModelSession.GenerationError.exceededContextWindowSize(context))
    expectCode(LanguageModelSession.GenerationError.assetsUnavailable(context), "ASSETS_UNAVAILABLE")
    expectCode(LanguageModelSession.GenerationError.guardrailViolation(context), "GUARDRAIL_VIOLATION")
    expectCode(LanguageModelSession.GenerationError.unsupportedGuide(context), "UNSUPPORTED_GUIDE")
    expectCode(
        LanguageModelSession.GenerationError.unsupportedLanguageOrLocale(context),
        "UNSUPPORTED_LANGUAGE_OR_LOCALE"
    )
    expectCode(LanguageModelSession.GenerationError.decodingFailure(context), "DECODING_FAILURE")
    expectCode(LanguageModelSession.GenerationError.rateLimited(context), "RATE_LIMITED")
    expectCode(LanguageModelSession.GenerationError.concurrentRequests(context), "SESSION_BUSY")
    expectCode(
        LanguageModelSession.GenerationError.refusal(.init(transcriptEntries: []), context),
        "REFUSAL"
    )
}

#if compiler(>=6.4)
@available(iOS 27.0, macOS 27.0, *)
private func testLanguageModelErrors() {
    expectContextOverflow(
        LanguageModelError.contextSizeExceeded(.init(contextSize: 4096, tokenCount: 20057, debugDescription: "test")),
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
    expectCode(LanguageModelSession.Error.transcriptMutationWhileResponding, "TRANSCRIPT_MUTATION_WHILE_RESPONDING")
    expectCode(SystemLanguageModel.Error.assetsUnavailable(.init(debugDescription: "test")), "ASSETS_UNAVAILABLE")
    expectCode(GeneratedContent.ParsingError(rawContent: "", debugDescription: "test"), "DECODING_FAILURE")
}
#endif

@main
struct FoundationModelsErrorMappingTests {
    static func main() {
        guard #available(iOS 26.0, macOS 26.0, *) else { return }
        testFallbacksKeepOperation()
        testAppleAIErrorsPassThroughWithoutRecovery()
        testToolCallErrors()
        testGenerationErrors()
        #if compiler(>=6.4)
        if #available(iOS 27.0, macOS 27.0, *) {
            testLanguageModelErrors()
        }
        #endif
        print("FoundationModelsErrorMappingTests passed")
    }
}
