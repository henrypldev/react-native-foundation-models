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

private func usage(input: Double, output: Double) -> NativeTokenUsage {
    NativeTokenUsage(
        inputTokens: input,
        cachedInputTokens: 0,
        outputTokens: output,
        reasoningTokens: 0,
        totalTokens: input + output
    )
}

@main
struct TokenUsageTests {
    static func main() {
        var ledger = UsageLedger()
        precondition(ledger.total(adding: nil) == nil, "no session usage means no total, as on iOS 26")
        precondition(ledger.total(adding: usage(input: 5, output: 1)) == usage(input: 5, output: 1), "fresh ledger")

        ledger.retire(usage(input: 400, output: 20))
        ledger.retire(usage(input: 90, output: 30))
        ledger.retire(nil)
        precondition(
            ledger.total(adding: usage(input: 60, output: 10)) == usage(input: 550, output: 60),
            "retired sessions add to the replacement session across a context reset"
        )
        precondition(ledger.total(adding: nil) == nil, "retired usage alone does not invent a total")

        ledger.beginRequest()
        ledger.finishRequest(using: usage(input: 60, output: 10))
        precondition(ledger.lastResponse == usage(input: 60, output: 10), "completed request")
        ledger.beginRequest()
        precondition(ledger.lastResponse == nil, "a failed request leaves no last response usage")

        #if compiler(>=6.4)
        if #available(macOS 27.0, *) {
            let mapped = NativeTokenUsage(
                LanguageModelSession.Usage(
                    input: .init(totalTokenCount: 84, cachedTokenCount: 65),
                    output: .init(totalTokenCount: 11, reasoningTokenCount: 4)
                )
            )
            precondition(
                mapped == NativeTokenUsage(
                    inputTokens: 84,
                    cachedInputTokens: 65,
                    outputTokens: 11,
                    reasoningTokens: 4,
                    totalTokens: 95
                ),
                "usage fields map one to one, got \(mapped)"
            )
        } else {
            print("skipped iOS 27 usage mapping: needs macOS 27")
        }
        #endif

        print("Swift token usage tests passed")
    }
}
