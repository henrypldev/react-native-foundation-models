import FoundationModels

extension NativeTokenUsage {
    static func + (lhs: NativeTokenUsage, rhs: NativeTokenUsage) -> NativeTokenUsage {
        NativeTokenUsage(
            inputTokens: lhs.inputTokens + rhs.inputTokens,
            cachedInputTokens: lhs.cachedInputTokens + rhs.cachedInputTokens,
            outputTokens: lhs.outputTokens + rhs.outputTokens,
            reasoningTokens: lhs.reasoningTokens + rhs.reasoningTokens,
            totalTokens: lhs.totalTokens + rhs.totalTokens
        )
    }
}

#if compiler(>=6.4)
@available(iOS 27.0, macOS 27.0, *)
extension NativeTokenUsage {
    init(_ usage: LanguageModelSession.Usage) {
        self.init(
            inputTokens: Double(usage.input.totalTokenCount),
            cachedInputTokens: Double(usage.input.cachedTokenCount),
            outputTokens: Double(usage.output.totalTokenCount),
            reasoningTokens: Double(usage.output.reasoningTokenCount),
            totalTokens: Double(usage.totalTokenCount)
        )
    }
}
#endif
