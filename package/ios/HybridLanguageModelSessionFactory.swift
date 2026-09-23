import NitroModules
import FoundationModels

/**
 * Factory class that creates LanguageModelSession instances.
 * This class implements the Nitro module specification and serves as the
 * bridge between React Native and Apple's FoundationModels framework.
 */
class HybridLanguageModelSessionFactory: HybridLanguageModelSessionFactorySpec {
    /**
     * Creates a new FMLanguageModelSession instance configured with the provided settings.
     *
     * - Parameter config: Configuration containing instructions and tools for the session
     * - Returns: A configured FMLanguageModelSession instance
     * - Throws: Any errors that occur during session creation
     */
    func create(config: LanguageModelSessionConfig) throws -> HybridLanguageModelSessionSpec {
        if #available(iOS 26.0, *) {
            let model = try Self.makeModel(
                useCase: config.useCase,
                guardrails: config.guardrails
            )
            return try HybridLanguageModelSession(config: config, model: model)
        } else {
            throw NSError(domain: "RNFoundationModels.FoundationModels", code: 1001, userInfo: [
                NSLocalizedDescriptionKey: "Apple Foundation Models requires iOS 26.0 or later"
            ])
        }
    }

    var isAvailable: Bool {
        if #available(iOS 26.0, *) {
            let model = SystemLanguageModel.default
            return model.isAvailable
        } else {
            return false
        }
    }

    var availabilityStatus: String {
        if #available(iOS 26.0, *) {
            let model = SystemLanguageModel.default
            switch model.availability {
            case .available:
                return "available"
            case .unavailable(.deviceNotEligible):
                return "unavailable.deviceNotEligible"
            case .unavailable(.appleIntelligenceNotEnabled):
                return "unavailable.appleIntelligenceNotEnabled"
            case .unavailable(.modelNotReady):
                return "unavailable.modelNotReady"
            case .unavailable(let other):
                return "unavailable.unknown(\(other))"
            }
        } else {
            return "unavailable.deviceNotEligible"
        }
    }

    /**
     * Reports the default system language model's context window size.
     *
     * Note: `SystemLanguageModel.contextSize` is only available starting iOS 26.4.
     * Returns `nil` on earlier versions.
     */
    var contextSize: Double? {
        if #available(iOS 26.4, *) {
            return Double(SystemLanguageModel.default.contextSize)
        }
        return nil
    }

    var modelVariant: String? {
        #if compiler(>=6.4)
        if #available(iOS 27.0, *) {
            return SystemLanguageModel.default.variant.displayName
        }
        #endif
        return nil
    }

    var modelCapabilities: [NativeModelCapability]? {
        #if compiler(>=6.4)
        if #available(iOS 27.0, *) {
            let capabilities = SystemLanguageModel.default.capabilities
            let table: [(NativeModelCapability, LanguageModelCapabilities.Capability)] = [
                (.vision, .vision),
                (.guidedgeneration, .guidedGeneration),
                (.reasoning, .reasoning),
                (.toolcalling, .toolCalling),
            ]
            return table.filter { capabilities.contains($0.1) }.map(\.0)
        }
        #endif
        return nil
    }

    @available(iOS 26.0, *)
    private static func makeModel(
        useCase: String?,
        guardrails: String?
    ) throws -> SystemLanguageModel {
        let resolvedGuardrails = try mapGuardrails(guardrails)

        switch useCase ?? "general" {
        case "general":
            return SystemLanguageModel(useCase: .general, guardrails: resolvedGuardrails)
        case "contentTagging":
            return SystemLanguageModel(useCase: .contentTagging, guardrails: resolvedGuardrails)
        default:
            throw AppleAIError.unsupportedPlatform("Unsupported SystemLanguageModel use case: \(useCase ?? "")")
        }
    }

    @available(iOS 26.0, *)
    private static func mapGuardrails(_ guardrails: String?) throws -> SystemLanguageModel.Guardrails {
        switch guardrails ?? "default" {
        case "default":
            return .default
        case "permissiveContentTransformations":
            return .permissiveContentTransformations
        default:
            throw AppleAIError.unsupportedPlatform("Unsupported SystemLanguageModel guardrails mode: \(guardrails ?? "")")
        }
    }
}
