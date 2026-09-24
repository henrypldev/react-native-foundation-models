import FoundationModels

@available(iOS 26.0, macOS 26.0, *)
extension LanguageModelSession: UsageReporting {}

@available(iOS 26.0, macOS 26.0, *)
extension LanguageModelSession.Response: UsageReporting {}

@available(iOS 26.0, macOS 26.0, *)
extension LanguageModelSession.ResponseStream.Snapshot: UsageReporting {}

#if compiler(>=6.4)

protocol UsageReporting {
    @available(iOS 27.0, macOS 27.0, *)
    var usage: LanguageModelSession.Usage { get }
}

extension UsageReporting {
    var tokenUsage: NativeTokenUsage? {
        guard #available(iOS 27.0, macOS 27.0, *) else { return nil }
        return NativeTokenUsage(usage)
    }
}

@available(iOS 27.0, macOS 27.0, *)
extension NativeTokenUsage {
    init(_ usage: LanguageModelSession.Usage) {
        self.init(
            inputTokens: Double(usage.input.totalTokenCount),
            cachedInputTokens: Double(usage.input.cachedTokenCount),
            outputTokens: Double(usage.output.totalTokenCount),
            reasoningTokens: Double(usage.output.reasoningTokenCount),
            totalTokens: Double(usage.totalTokenCount)
        )
    }
}

@available(iOS 27.0, macOS 27.0, *)
private extension ContextOptions {
    init(_ reasoningLevel: NativeReasoningLevel?, includeSchemaInPrompt: Bool? = nil) {
        let level: ReasoningLevel? = switch reasoningLevel {
        case .light: .light
        case .moderate: .moderate
        case .deep: .deep
        case nil: nil
        }
        self.init(includeSchemaInPrompt: includeSchemaInPrompt, reasoningLevel: level)
    }
}

@available(iOS 26.0, macOS 26.0, *)
extension LanguageModelSession {
    func respond(
        to prompt: String,
        options: GenerationOptions,
        reasoningLevel: NativeReasoningLevel?
    ) async throws -> Response<String> {
        guard #available(iOS 27.0, macOS 27.0, *) else {
            return try await respond(to: prompt, options: options)
        }
        return try await respond(to: prompt, options: options, contextOptions: ContextOptions(reasoningLevel))
    }

    func respond(
        to prompt: String,
        schema: GenerationSchema,
        options: GenerationOptions,
        reasoningLevel: NativeReasoningLevel?
    ) async throws -> Response<GeneratedContent> {
        guard #available(iOS 27.0, macOS 27.0, *) else {
            return try await respond(to: prompt, schema: schema, options: options)
        }
        return try await respond(
            to: prompt,
            schema: schema,
            options: options,
            contextOptions: ContextOptions(reasoningLevel, includeSchemaInPrompt: true)
        )
    }

    func streamResponse(
        to prompt: String,
        options: GenerationOptions,
        reasoningLevel: NativeReasoningLevel?
    ) -> ResponseStream<String> {
        guard #available(iOS 27.0, macOS 27.0, *) else {
            return streamResponse(to: prompt, options: options)
        }
        return streamResponse(to: prompt, options: options, contextOptions: ContextOptions(reasoningLevel))
    }

    func streamResponse(
        to prompt: String,
        schema: GenerationSchema,
        options: GenerationOptions,
        reasoningLevel: NativeReasoningLevel?
    ) -> ResponseStream<GeneratedContent> {
        guard #available(iOS 27.0, macOS 27.0, *) else {
            return streamResponse(to: prompt, schema: schema, options: options)
        }
        return streamResponse(
            to: prompt,
            schema: schema,
            options: options,
            contextOptions: ContextOptions(reasoningLevel, includeSchemaInPrompt: true)
        )
    }
}

@available(iOS 26.0, macOS 26.0, *)
extension GenerationOptions {
    init(
        samplingMode: SamplingMode?,
        temperature: Double?,
        maximumResponseTokens: Int?,
        requestedToolCallingMode: NativeToolCallingMode?
    ) {
        guard #available(iOS 27.0, macOS 27.0, *), let requestedToolCallingMode else {
            self.init(samplingMode: samplingMode, temperature: temperature, maximumResponseTokens: maximumResponseTokens)
            return
        }
        let toolCallingMode: ToolCallingMode = switch requestedToolCallingMode {
        case .allowed: .allowed
        case .required: .required
        case .disallowed: .disallowed
        }
        self.init(
            samplingMode: samplingMode,
            temperature: temperature,
            maximumResponseTokens: maximumResponseTokens,
            toolCallingMode: toolCallingMode
        )
    }
}

@available(iOS 26.0, macOS 26.0, *)
extension SystemLanguageModel {
    var variantDisplayName: String? {
        guard #available(iOS 27.0, macOS 27.0, *) else { return nil }
        return variant.displayName
    }

    var nativeCapabilities: [NativeModelCapability]? {
        guard #available(iOS 27.0, macOS 27.0, *) else { return nil }
        let table: [(NativeModelCapability, LanguageModelCapabilities.Capability)] = [
            (.vision, .vision),
            (.guidedgeneration, .guidedGeneration),
            (.reasoning, .reasoning),
            (.toolcalling, .toolCalling),
        ]
        return table.filter { capabilities.contains($0.1) }.map(\.0)
    }
}

@available(iOS 26.0, macOS 26.0, *)
extension AppleAIError {
    static func mappingTypedError(_ error: any Error, during op: GenerationOperation) -> AppleAIError? {
        guard #available(iOS 27.0, macOS 27.0, *) else { return nil }
        switch error {
        case let error as LanguageModelError:
            return mapping(error, during: op)
        case let error as LanguageModelSession.Error:
            return mapping(error, during: op)
        case let error as SystemLanguageModel.Error:
            return mapping(error, during: op)
        case let error as GeneratedContent.ParsingError:
            return failed(.decodingFailure, error.debugDescription, during: op)
        default:
            return nil
        }
    }

    @available(iOS 27.0, macOS 27.0, *)
    private static func mapping(_ error: LanguageModelError, during op: GenerationOperation) -> AppleAIError {
        switch error {
        case .contextSizeExceeded: .contextExceeded
        case .rateLimited(let d): failed(.rateLimited, d.debugDescription, during: op)
        case .guardrailViolation(let d): failed(.guardrailViolation, d.debugDescription, during: op)
        case .refusal(let d): failed(.refusal, d.debugDescription, during: op)
        case .unsupportedCapability(let d): failed(.unsupportedCapability, d.debugDescription, during: op)
        case .unsupportedTranscriptContent(let d): failed(.unsupportedTranscriptContent, d.debugDescription, during: op)
        case .unsupportedGenerationGuide(let d): failed(.unsupportedGuide, d.debugDescription, during: op)
        case .unsupportedLanguageOrLocale(let d): failed(.unsupportedLanguageOrLocale, d.debugDescription, during: op)
        case .timeout(let d): failed(.timeout, d.debugDescription, during: op)
        @unknown default: failed(.generic, error.localizedDescription, during: op)
        }
    }

    @available(iOS 27.0, macOS 27.0, *)
    private static func mapping(_ error: LanguageModelSession.Error, during op: GenerationOperation) -> AppleAIError {
        switch error {
        case .concurrentRequests, .transcriptMutationWhileResponding: .sessionBusy
        @unknown default: failed(.generic, error.debugDescription, during: op)
        }
    }

    @available(iOS 27.0, macOS 27.0, *)
    private static func mapping(_ error: SystemLanguageModel.Error, during op: GenerationOperation) -> AppleAIError {
        switch error {
        case .assetsUnavailable(let d): failed(.assetsUnavailable, d.debugDescription, during: op)
        @unknown default: failed(.generic, error.debugDescription, during: op)
        }
    }
}

#else

protocol UsageReporting {}

extension UsageReporting {
    var tokenUsage: NativeTokenUsage? { nil }
}

@available(iOS 26.0, macOS 26.0, *)
extension LanguageModelSession {
    func respond(
        to prompt: String,
        options: GenerationOptions,
        reasoningLevel: NativeReasoningLevel?
    ) async throws -> Response<String> {
        try await respond(to: prompt, options: options)
    }

    func respond(
        to prompt: String,
        schema: GenerationSchema,
        options: GenerationOptions,
        reasoningLevel: NativeReasoningLevel?
    ) async throws -> Response<GeneratedContent> {
        try await respond(to: prompt, schema: schema, options: options)
    }

    func streamResponse(
        to prompt: String,
        options: GenerationOptions,
        reasoningLevel: NativeReasoningLevel?
    ) -> ResponseStream<String> {
        streamResponse(to: prompt, options: options)
    }

    func streamResponse(
        to prompt: String,
        schema: GenerationSchema,
        options: GenerationOptions,
        reasoningLevel: NativeReasoningLevel?
    ) -> ResponseStream<GeneratedContent> {
        streamResponse(to: prompt, schema: schema, options: options)
    }
}

@available(iOS 26.0, macOS 26.0, *)
extension GenerationOptions {
    init(
        samplingMode: SamplingMode?,
        temperature: Double?,
        maximumResponseTokens: Int?,
        requestedToolCallingMode: NativeToolCallingMode?
    ) {
        self.init(sampling: samplingMode, temperature: temperature, maximumResponseTokens: maximumResponseTokens)
    }
}

@available(iOS 26.0, macOS 26.0, *)
extension SystemLanguageModel {
    var variantDisplayName: String? { nil }
    var nativeCapabilities: [NativeModelCapability]? { nil }
}

@available(iOS 26.0, macOS 26.0, *)
extension AppleAIError {
    static func mappingTypedError(_ error: any Error, during op: GenerationOperation) -> AppleAIError? { nil }
}

#endif
