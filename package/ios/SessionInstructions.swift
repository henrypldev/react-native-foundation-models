enum SessionInstructions {
    private static let defaultBase = "You are a helpful assistant"
    private static let toolsHeader = ". You have access to these tools:\n"
    private static let summaryHeader = "\n\nPrevious conversation summary: "

    static func compose(base: String?, tools: [(name: String, description: String)]) -> String {
        let base = base ?? defaultBase
        guard !tools.isEmpty else { return base }
        let toolDescriptions = tools.map { "- \($0.name): \($0.description)" }.joined(separator: "\n")
        return base + toolsHeader + toolDescriptions
    }

    static func withSummary(_ instructions: String, summary: String) -> String {
        instructions + summaryHeader + summary
    }

    static func base(of instructions: String) -> String {
        let withoutSummary = instructions.prefix(before: summaryHeader)
        return String(withoutSummary.prefix(before: toolsHeader))
    }
}

private extension StringProtocol {
    func prefix(before marker: String) -> SubSequence {
        guard let range = range(of: marker) else { return self[...] }
        return self[..<range.lowerBound]
    }
}
