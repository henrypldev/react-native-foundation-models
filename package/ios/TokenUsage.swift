extension NativeTokenUsage {
    static var zero: NativeTokenUsage {
        NativeTokenUsage(inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, reasoningTokens: 0, totalTokens: 0)
    }

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

struct UsageLedger {
    private var retired = NativeTokenUsage.zero
    private(set) var lastResponse: NativeTokenUsage?

    mutating func beginRequest() {
        lastResponse = nil
    }

    mutating func finishRequest(using usage: NativeTokenUsage?) {
        lastResponse = usage
    }

    mutating func retire(_ usage: NativeTokenUsage?) {
        guard let usage else { return }
        retired = retired + usage
    }

    func total(adding current: NativeTokenUsage?) -> NativeTokenUsage? {
        current.map { retired + $0 }
    }
}
