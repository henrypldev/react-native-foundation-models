import Foundation

private enum TestFailure: Error {
    case expected
}

@main
struct StreamingResponseAccumulatorTests {
    static func main() async throws {
        var continuation: AsyncStream<String>.Continuation!
        let stream = AsyncStream<String> { continuation = $0 }
        continuation.yield("one")
        continuation.yield("one two")
        continuation.finish()

        var snapshots: [String] = []
        let response = try await consumeStreamingResponse(stream) { snapshots.append($0) }

        precondition(response == "one two")
        precondition(snapshots == ["one", "one two"])

        let emptyStream = AsyncStream<String> { $0.finish() }
        let emptyResponse = try await consumeStreamingResponse(emptyStream) { _ in }
        precondition(emptyResponse == nil)

        let failingStream = AsyncThrowingStream<String, Error> { continuation in
            continuation.yield("partial")
            continuation.finish(throwing: TestFailure.expected)
        }

        do {
            _ = try await consumeStreamingResponse(failingStream) { _ in }
            preconditionFailure("Expected the stream failure to propagate")
        } catch TestFailure.expected {
            // Expected.
        }

        let bridgedError = AppleAIError.sessionBusy
        precondition(bridgedError.code == "SESSION_BUSY")
        precondition(
            bridgedError.description ==
                "[SESSION_BUSY] Another language model request is already in progress for this session"
        )

        print("Swift streaming and bridge error tests passed")
    }
}
