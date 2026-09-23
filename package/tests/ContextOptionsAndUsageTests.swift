import FoundationModels

extension NativeTokenUsage: Equatable {
    static func == (lhs: Self, rhs: Self) -> Bool {
        lhs.inputTokens == rhs.inputTokens
            && lhs.cachedInputTokens == rhs.cachedInputTokens
            && lhs.outputTokens == rhs.outputTokens
            && lhs.reasoningTokens == rhs.reasoningTokens
            && lhs.totalTokens == rhs.totalTokens
    }
}

@main
struct ContextOptionsAndUsageTests {
    static func main() {
        precondition(ContextOptions(nil) == ContextOptions(), "nil options")
        precondition(
            ContextOptions(NativeGenerationOptions()) == ContextOptions(),
            "no reasoning level"
        )
        let levels: [(NativeReasoningLevel, ContextOptions.ReasoningLevel)] = [
            (.light, .light),
            (.moderate, .moderate),
            (.deep, .deep),
        ]
        for (native, expected) in levels {
            precondition(
                ContextOptions(NativeGenerationOptions(reasoningLevel: native)) == ContextOptions(reasoningLevel: expected),
                "reasoning level \(native)"
            )
        }
        precondition(
            ContextOptions(NativeGenerationOptions(reasoningLevel: .deep), includeSchemaInPrompt: true)
                == ContextOptions(includeSchemaInPrompt: true, reasoningLevel: .deep),
            "schema flag is kept next to the reasoning level"
        )

        let usage = NativeTokenUsage(
            LanguageModelSession.Usage(
                input: .init(totalTokenCount: 84, cachedTokenCount: 65),
                output: .init(totalTokenCount: 11, reasoningTokenCount: 4)
            )
        )
        precondition(
            usage == NativeTokenUsage(
                inputTokens: 84,
                cachedInputTokens: 65,
                outputTokens: 11,
                reasoningTokens: 4,
                totalTokens: 95
            ),
            "usage fields map one to one, got \(usage)"
        )

        let first = NativeTokenUsage(inputTokens: 61, cachedInputTokens: 0, outputTokens: 13, reasoningTokens: 0, totalTokens: 74)
        precondition(
            first + usage == NativeTokenUsage(
                inputTokens: 145,
                cachedInputTokens: 65,
                outputTokens: 24,
                reasoningTokens: 4,
                totalTokens: 169
            ),
            "usage adds field by field"
        )

        print("Swift context options and usage tests passed")
    }
}
