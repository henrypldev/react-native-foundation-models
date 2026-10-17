import Foundation
import FoundationModels

private func expectInvalid(_ uri: String, at index: Int = 0, _ label: String) {
    do {
        _ = try PromptImageFile.url(uri, at: index)
        preconditionFailure("\(label) must throw")
    } catch let error as AppleAIError {
        precondition(error.code == "INVALID_PROMPT", "\(label) threw \(error.code)")
        precondition(
            error.localizedDescription.contains("images[\(index)].uri"),
            "\(label) must name the image index, got: \(error.localizedDescription)"
        )
    } catch {
        preconditionFailure("\(label) threw a non-AppleAIError: \(error)")
    }
}

@main
struct PromptImageFileTests {
    static func main() throws {
        let directory = FileManager.default.temporaryDirectory
            .appending(path: "rn-foundation-models-prompt-image-\(UUID().uuidString)")
        try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: directory) }
        let image = directory.appending(path: "receipt photo.jpg")
        try Data([0xFF, 0xD8, 0xFF]).write(to: image)

        let resolved = try PromptImageFile.url(image.absoluteString, at: 0)
        precondition(resolved.standardizedFileURL == image.standardizedFileURL, "a file URL to an existing file resolves to that file")

        expectInvalid("https://example.com/receipt.jpg", "a remote URL")
        expectInvalid("ph://ABC-123", at: 2, "a photo library URI")
        expectInvalid(image.path(percentEncoded: false), "a bare path without the file scheme")
        expectInvalid(directory.appending(path: "missing.jpg").absoluteString, at: 1, "a file URL to a missing file")
        expectInvalid(directory.absoluteString, "a file URL to a directory")

        if #available(macOS 27.0, *) {
            do {
                _ = try SystemLanguageModel.default.prompt(from: NativePrompt(
                    text: "What is on this receipt?",
                    images: [
                        NativePromptImage(url: image.absoluteString, label: "receipt"),
                        NativePromptImage(url: "https://example.com/receipt.jpg", label: nil),
                    ]
                ))
                preconditionFailure("a prompt with a remote image must throw")
            } catch let error as AppleAIError {
                precondition(error.code == "INVALID_PROMPT", "a prompt with a remote image threw \(error.code)")
                precondition(
                    error.localizedDescription.contains("images[1].uri"),
                    "the prompt error names the failing image, got: \(error.localizedDescription)"
                )
            }
        }

        print("PromptImageFileTests passed")
    }
}
