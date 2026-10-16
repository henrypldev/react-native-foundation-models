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

struct NativeGenerationOptions {
    var temperature: Double? = nil
    var maximumResponseTokens: Double? = nil
    var samplingMode: NativeSamplingMode? = nil
    var samplingTop: Double? = nil
    var samplingProbabilityThreshold: Double? = nil
    var samplingSeed: Double? = nil
    var toolCallingMode: NativeToolCallingMode? = nil
}
