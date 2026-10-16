@main
struct SessionInstructionsTests {
    static func main() {
        let weather = [(name: "getWeather", description: "Current weather")]
        let search = [(name: "search", description: "Web search")]

        precondition(SessionInstructions.compose(base: nil, tools: []) == "You are a helpful assistant")

        let original = SessionInstructions.compose(base: "Answer like a pirate", tools: weather)
        let firstRecovery = SessionInstructions.withSummary(original, summary: "S1")
        precondition(SessionInstructions.base(of: firstRecovery) == "Answer like a pirate")
        precondition(SessionInstructions.base(of: "Answer like a pirate") == "Answer like a pirate")

        let restored = SessionInstructions.compose(base: SessionInstructions.base(of: firstRecovery), tools: search)
        let secondRecovery = SessionInstructions.withSummary(restored, summary: "S2")
        precondition(!secondRecovery.contains("S1"), "Summaries stack across restore: \(secondRecovery)")
        precondition(!secondRecovery.contains("getWeather"), "Restored session kept old tools: \(secondRecovery)")
        precondition(secondRecovery.contains("- search: Web search"))
        precondition(secondRecovery.hasSuffix("S2"))

        print("Swift session instructions tests passed")
    }
}
