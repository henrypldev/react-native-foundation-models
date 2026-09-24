import FoundationModels

private func expectInvalid(_ native: NativeGenerationOptions, _ label: String) {
    do {
        _ = try GenerationOptions(native)
        preconditionFailure("\(label) must throw")
    } catch let error as AppleAIError {
        precondition(error.code == "INVALID_GENERATION_OPTIONS", "\(label) threw \(error.code)")
    } catch {
        preconditionFailure("\(label) threw a non-AppleAIError: \(error)")
    }
}

private func expectMapped(_ native: NativeGenerationOptions?, _ expected: GenerationOptions, _ label: String) {
    do {
        let options = try GenerationOptions(native)
        precondition(options == expected, "\(label) mapped to \(options)")
    } catch {
        preconditionFailure("\(label) threw \(error)")
    }
}

@main
struct GenerationOptionsMappingTests {
    static func main() {
        expectMapped(nil, GenerationOptions(), "nil options")
        expectMapped(NativeGenerationOptions(), GenerationOptions(), "empty options")
        expectMapped(
            NativeGenerationOptions(temperature: 0.5, maximumResponseTokens: 5),
            GenerationOptions(temperature: 0.5, maximumResponseTokens: 5),
            "temperature and maximumResponseTokens"
        )
        expectMapped(
            NativeGenerationOptions(samplingMode: .greedy),
            GenerationOptions(samplingMode: .greedy),
            "greedy"
        )
        expectMapped(
            NativeGenerationOptions(samplingMode: .greedy, samplingTop: 40),
            GenerationOptions(samplingMode: .greedy),
            "greedy ignores samplingTop"
        )
        expectMapped(
            NativeGenerationOptions(samplingMode: .randomtopk, samplingTop: 40, samplingSeed: 7),
            GenerationOptions(samplingMode: .random(top: 40, seed: 7)),
            "randomTopK with seed"
        )
        expectMapped(
            NativeGenerationOptions(samplingMode: .randomtopk, samplingTop: 40),
            GenerationOptions(samplingMode: .random(top: 40, seed: nil)),
            "randomTopK without seed"
        )
        expectMapped(
            NativeGenerationOptions(samplingMode: .randomprobabilitythreshold, samplingProbabilityThreshold: 0.9, samplingSeed: 1),
            GenerationOptions(samplingMode: .random(probabilityThreshold: 0.9, seed: 1)),
            "randomProbabilityThreshold"
        )

        if #available(macOS 27.0, *) {
            let modes: [(NativeToolCallingMode, GenerationOptions.ToolCallingMode)] = [
                (.allowed, .allowed),
                (.required, .required),
                (.disallowed, .disallowed),
            ]
            for (native, expected) in modes {
                expectMapped(
                    NativeGenerationOptions(toolCallingMode: native),
                    GenerationOptions(toolCallingMode: expected),
                    "toolCallingMode \(native)"
                )
            }
        }

        expectInvalid(NativeGenerationOptions(samplingMode: .randomtopk), "randomTopK without samplingTop")
        expectInvalid(
            NativeGenerationOptions(samplingMode: .randomprobabilitythreshold),
            "randomProbabilityThreshold without samplingProbabilityThreshold"
        )
        expectInvalid(NativeGenerationOptions(samplingMode: .randomtopk, samplingTop: 1.5), "fractional samplingTop")
        expectInvalid(NativeGenerationOptions(samplingMode: .randomtopk, samplingTop: .infinity), "infinite samplingTop")
        expectInvalid(
            NativeGenerationOptions(samplingMode: .randomtopk, samplingTop: 40, samplingSeed: -1),
            "negative samplingSeed"
        )
        expectInvalid(
            NativeGenerationOptions(samplingMode: .greedy, samplingSeed: .nan),
            "NaN samplingSeed"
        )
        expectInvalid(NativeGenerationOptions(maximumResponseTokens: 2.5), "fractional maximumResponseTokens")
        expectInvalid(NativeGenerationOptions(maximumResponseTokens: 1e300), "out of range maximumResponseTokens")

        print("GenerationOptionsMappingTests passed")
    }
}
