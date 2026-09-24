enum NativeSamplingMode {
    case greedy
    case randomtopk
    case randomprobabilitythreshold
}

enum NativeToolCallingMode {
    case allowed
    case required
    case disallowed
}

enum NativeReasoningLevel {
    case light
    case moderate
    case deep
}

struct NativeGenerationOptions {
    var temperature: Double? = nil
    var maximumResponseTokens: Double? = nil
    var samplingMode: NativeSamplingMode? = nil
    var samplingTop: Double? = nil
    var samplingProbabilityThreshold: Double? = nil
    var samplingSeed: Double? = nil
    var toolCallingMode: NativeToolCallingMode? = nil
    var reasoningLevel: NativeReasoningLevel? = nil
}

struct NativeTokenUsage {
    var inputTokens: Double
    var cachedInputTokens: Double
    var outputTokens: Double
    var reasoningTokens: Double
    var totalTokens: Double
}

enum NativeModelCapability {
    case vision
    case guidedgeneration
    case reasoning
    case toolcalling
}
