import Foundation

/// Foundation Models snapshots contain the complete partially generated response,
/// so the last snapshot is also the completed response.
func consumeStreamingResponse<Stream: AsyncSequence>(
    _ stream: Stream,
    onSnapshot: (Stream.Element) -> Void
) async throws -> Stream.Element? {
    var last: Stream.Element?

    for try await snapshot in stream {
        last = snapshot
        onSnapshot(snapshot)
    }

    return last
}
