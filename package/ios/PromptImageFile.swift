import Foundation

enum PromptImageFile {
    static func url(_ uri: String, at index: Int) throws -> URL {
        let field = "images[\(index)].uri"
        guard let url = URL(string: uri), url.isFileURL else {
            throw AppleAIError.invalidPrompt("\(field) must be a file:// URL")
        }
        var isDirectory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: url.path(percentEncoded: false), isDirectory: &isDirectory),
              !isDirectory.boolValue else {
            throw AppleAIError.invalidPrompt("\(field) does not point to a file")
        }
        return url
    }
}
