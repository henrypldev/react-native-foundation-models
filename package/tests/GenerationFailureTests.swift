import Foundation
import FoundationModels

private struct UnrecognizedError: Error {}

private struct EchoTool: Tool {
    let name = "echo"
    let description = "Echoes its input"
    func call(arguments: GeneratedContent) async throws -> String { "" }
}

private func code(_ error: any Error, during operation: GenerationOperation = .response) -> String {
    AppleAIError(generationFailure: error, during: operation).code
}

@main
struct GenerationFailureTests {
    static func main() {
        let context = LanguageModelSession.GenerationError.Context(debugDescription: "test")

        precondition(code(UnrecognizedError(), during: .response) == "SESSION_RESPONSE_ERROR")
        precondition(code(UnrecognizedError(), during: .streaming) == "SESSION_STREAMING_ERROR")

        let deprecatedCodes: [(any Error, String)] = [
            (LanguageModelSession.GenerationError.exceededContextWindowSize(context), "CONTEXT_EXCEEDED"),
            (LanguageModelSession.GenerationError.assetsUnavailable(context), "ASSETS_UNAVAILABLE"),
            (LanguageModelSession.GenerationError.guardrailViolation(context), "GUARDRAIL_VIOLATION"),
            (LanguageModelSession.GenerationError.unsupportedGuide(context), "UNSUPPORTED_GUIDE"),
            (LanguageModelSession.GenerationError.unsupportedLanguageOrLocale(context), "UNSUPPORTED_LANGUAGE_OR_LOCALE"),
            (LanguageModelSession.GenerationError.decodingFailure(context), "DECODING_FAILURE"),
            (LanguageModelSession.GenerationError.rateLimited(context), "RATE_LIMITED"),
            (LanguageModelSession.GenerationError.concurrentRequests(context), "SESSION_BUSY"),
            (LanguageModelSession.GenerationError.refusal(.init(transcriptEntries: []), context), "REFUSAL"),
        ]
        for (error, expected) in deprecatedCodes {
            precondition(code(error) == expected, "\(error) maps to \(code(error)), expected \(expected)")
        }

        precondition(
            code(LanguageModelSession.ToolCallError(tool: EchoTool(), underlyingError: AppleAIError.contextExceeded))
                == "CONTEXT_EXCEEDED"
        )
        precondition(
            code(LanguageModelSession.ToolCallError(tool: EchoTool(), underlyingError: UnrecognizedError()))
                == "TOOL_CALL_ERROR"
        )

        precondition(
            AppleAIError.requiresContextRecovery(
                after: LanguageModelSession.GenerationError.exceededContextWindowSize(context)
            ),
            "GenerationError.exceededContextWindowSize must drive context recovery"
        )
        precondition(
            !AppleAIError.requiresContextRecovery(after: AppleAIError.contextExceeded),
            "A passed-through AppleAIError.contextExceeded must not reset the session"
        )
        precondition(
            !AppleAIError.requiresContextRecovery(
                after: LanguageModelSession.ToolCallError(tool: EchoTool(), underlyingError: AppleAIError.contextExceeded)
            ),
            "A tool that throws AppleAIError.contextExceeded must not reset the session"
        )

        #if compiler(>=6.4)
        if #available(macOS 27.0, *) {
            precondition(
                AppleAIError.requiresContextRecovery(
                    after: LanguageModelError.contextSizeExceeded(
                        .init(contextSize: 4096, tokenCount: 5000, debugDescription: "test")
                    )
                ),
                "LanguageModelError.contextSizeExceeded must drive context recovery"
            )

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
                code(LanguageModelSession.Error.transcriptMutationWhileResponding)
                    == "TRANSCRIPT_MUTATION_WHILE_RESPONDING"
            )
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
