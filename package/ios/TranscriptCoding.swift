import Foundation
import FoundationModels

@available(iOS 26.0, macOS 26.0, *)
enum TranscriptCoding {
    static func encode(_ transcript: Transcript) throws -> String {
        do {
            return String(decoding: try JSONEncoder().encode(transcript), as: UTF8.self)
        } catch {
            throw AppleAIError.transcriptEncodingError(error)
        }
    }

    static func decode(_ json: String) throws -> Transcript {
        do {
            return try JSONDecoder().decode(Transcript.self, from: Data(json.utf8))
        } catch {
            throw AppleAIError.invalidTranscript(reason(for: error))
        }
    }

    static func instructionsText(in transcript: Transcript) -> String? {
        for entry in transcript {
            guard case .instructions(let instructions) = entry else { continue }
            let text = instructions.segments.compactMap { segment -> String? in
                guard case .text(let textSegment) = segment else { return nil }
                return textSegment.content
            }.joined(separator: "\n")
            return text.isEmpty ? nil : text
        }
        return nil
    }

    private static func reason(for error: any Error) -> String {
        guard let decodingError = error as? DecodingError else {
            return error.localizedDescription
        }
        switch decodingError {
        case .dataCorrupted(let context):
            return context.underlyingError == nil
                ? context.debugDescription
                : "the value is not valid JSON"
        case .keyNotFound(let key, _):
            return "missing key '\(key.stringValue)'"
        case .typeMismatch(_, let context), .valueNotFound(_, let context):
            return context.debugDescription
        @unknown default:
            return decodingError.localizedDescription
        }
    }
}
