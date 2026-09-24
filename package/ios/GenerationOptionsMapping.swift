import FoundationModels

@available(iOS 26.0, macOS 26.0, *)
extension GenerationOptions {
    init(_ native: NativeGenerationOptions?) throws {
        guard let native else {
            self.init()
            return
        }
        let samplingMode = try native.samplingMode.map { try Self.samplingMode($0, of: native) }
        let maximumResponseTokens = try native.maximumResponseTokens.map {
            try exactly(Int.self, $0, field: "maximumResponseTokens")
        }

        #if compiler(>=6.4)
        self.init(samplingMode: samplingMode, temperature: native.temperature, maximumResponseTokens: maximumResponseTokens)
        if #available(iOS 27.0, macOS 27.0, *), let toolCallingMode = native.toolCallingMode {
            self.toolCallingMode = switch toolCallingMode {
            case .allowed: .allowed
            case .required: .required
            case .disallowed: .disallowed
            }
        }
        #else
        self.init(sampling: samplingMode, temperature: native.temperature, maximumResponseTokens: maximumResponseTokens)
        #endif
    }

    private static func samplingMode(_ kind: NativeSamplingMode, of native: NativeGenerationOptions) throws -> SamplingMode {
        let seed = try native.samplingSeed.map { try exactly(UInt64.self, $0, field: "samplingSeed") }
        switch kind {
        case .greedy:
            return .greedy
        case .randomtopk:
            guard let top = native.samplingTop else {
                throw AppleAIError.invalidGenerationOptions("samplingTop is required when samplingMode is randomTopK")
            }
            return .random(top: try exactly(Int.self, top, field: "samplingTop"), seed: seed)
        case .randomprobabilitythreshold:
            guard let threshold = native.samplingProbabilityThreshold else {
                throw AppleAIError.invalidGenerationOptions(
                    "samplingProbabilityThreshold is required when samplingMode is randomProbabilityThreshold"
                )
            }
            return .random(probabilityThreshold: threshold, seed: seed)
        }
    }
}

private func exactly<T: BinaryInteger>(_: T.Type, _ value: Double, field: String) throws -> T {
    guard let integer = T(exactly: value) else {
        throw AppleAIError.invalidGenerationOptions("\(field) must be an integer in range, got \(value)")
    }
    return integer
}
