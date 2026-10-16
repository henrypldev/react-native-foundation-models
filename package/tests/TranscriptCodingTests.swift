import FoundationModels

private func text(_ content: String) -> Transcript.Segment {
    .text(Transcript.TextSegment(content: content))
}

private func expectInvalid(_ json: String, _ label: String) {
    do {
        _ = try TranscriptCoding.decode(json)
        preconditionFailure("\(label) must throw")
    } catch let error as AppleAIError {
        precondition(error.code == "INVALID_TRANSCRIPT", "\(label) threw \(error.code)")
    } catch {
        preconditionFailure("\(label) threw a non-AppleAIError: \(error)")
    }
}

@main
struct TranscriptCodingTests {
    static func main() throws {
        let transcript = Transcript(entries: [
            .instructions(Transcript.Instructions(
                segments: [text("Be brief."), text("Answer in English.")],
                toolDefinitions: []
            )),
            .prompt(Transcript.Prompt(segments: [text("My name is Ana.")])),
        ])

        let json = try TranscriptCoding.encode(transcript)
        let decoded = try TranscriptCoding.decode(json)
        precondition(decoded == transcript, "encode then decode must round-trip")

        precondition(
            TranscriptCoding.instructionsText(in: transcript) == "Be brief.\nAnswer in English.",
            "instructionsText joins the instruction text segments"
        )
        let withoutInstructions = Transcript(entries: [
            .prompt(Transcript.Prompt(segments: [text("Hello")])),
        ])
        precondition(
            TranscriptCoding.instructionsText(in: withoutInstructions) == nil,
            "instructionsText is nil without an instructions entry"
        )

        expectInvalid("not json", "invalid JSON")
        expectInvalid("{}", "empty object")
        let futureVersion = json.replacingOccurrences(of: "\"version\":\"1.1\"", with: "\"version\":\"9.9\"")
        precondition(futureVersion != json, "encoded transcript carries version 1.1")
        expectInvalid(futureVersion, "unsupported version")

        print("TranscriptCodingTests passed")
    }
}
