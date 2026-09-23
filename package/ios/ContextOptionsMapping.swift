import FoundationModels

#if compiler(>=6.4)
@available(iOS 27.0, macOS 27.0, *)
extension ContextOptions {
    init(_ native: NativeGenerationOptions?, includeSchemaInPrompt: Bool? = nil) {
        let reasoningLevel: ReasoningLevel? = switch native?.reasoningLevel {
        case .light: .light
        case .moderate: .moderate
        case .deep: .deep
        case nil: nil
        }
        self.init(includeSchemaInPrompt: includeSchemaInPrompt, reasoningLevel: reasoningLevel)
    }
}
#endif
