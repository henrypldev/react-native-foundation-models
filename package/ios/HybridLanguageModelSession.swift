import NitroModules
import FoundationModels
import Synchronization

@available(iOS 26.0, *)
private struct SessionState {
    var session: LanguageModelSession
    var isResponding = false
    var wasContextReset = false
    var usage = UsageLedger()
}

@available(iOS 26.0, *)
class HybridLanguageModelSession: HybridLanguageModelSessionSpec {
    private let state: Mutex<SessionState>
    private let tools: [any Tool]
    private let baseInstructions: String
    private let model: SystemLanguageModel
    
    /**
     * Initializes the wrapper with a FoundationModels session configured
     * according to the provided configuration.
     *
     * - Parameter config: Custom configuration containing instructions and HybridTool instances
     * - Throws: Any errors that occur during session creation
     */
    init(config: LanguageModelSessionConfig, model: SystemLanguageModel) throws {
        let jsTools: [ToolDefinition] = config.tools ?? []
        var tools: [any Tool] = []
        
        if (!jsTools.isEmpty) {
            do {
                tools = try jsTools.map { tool in
                    return try HybridTool(
                        name: tool.name,
                        description: tool.description,
                        parameters: tool.arguments,
                        handler: { args in tool.handler(args) }
                    )
                }
            } catch {
                throw AppleAIError.toolCallError(error)
            }
        }
        
        let toolSummaries = jsTools.map { (name: $0.name, description: $0.description) }
        let session: LanguageModelSession
        let baseInstructions: String
        if let transcript = config.transcript {
            let decoded = try TranscriptCoding.decode(transcript)
            session = LanguageModelSession(model: model, tools: tools, transcript: decoded)
            let restoredBase = TranscriptCoding.instructionsText(in: decoded).map(SessionInstructions.base(of:))
            baseInstructions = SessionInstructions.compose(base: restoredBase, tools: toolSummaries)
        } else {
            baseInstructions = SessionInstructions.compose(base: config.instructions, tools: toolSummaries)
            session = LanguageModelSession(model: model, tools: tools, instructions: baseInstructions)
        }
        self.model = model
        self.state = Mutex(SessionState(session: session))
        self.tools = tools
        self.baseInstructions = baseInstructions
    }
    
    @available(iOS 26.0, *)
    func respond(prompt: NativePrompt, schema: AnyMap?, options: NativeGenerationOptions?) throws -> Promise<String> {
        state.withLock { $0.usage.beginRequest() }
        guard let document = schema?.schemaDocument() else {
            guard !Self.isEmpty(prompt) else { return Promise.resolved(withResult: "") }
            return generate(prompt, during: .response, options: options) { session, prompt, generationOptions in
                let response = try await session.respond(to: prompt, options: generationOptions, reasoningLevel: options?.reasoningLevel)
                return (response.content, response.tokenUsage)
            }
        }
        return generate(prompt, during: .response, options: options) { session, prompt, generationOptions in
            let generationSchema = try GenerationSchemaBuilder.responseSchema(from: document)
            let response = try await session.respond(
                to: prompt,
                schema: generationSchema,
                options: generationOptions,
                reasoningLevel: options?.reasoningLevel
            )
            return (response.content.jsonString, response.tokenUsage)
        }
    }

    @available(iOS 26.0, *)
    func streamResponse(
        prompt: NativePrompt,
        onStream: @escaping (String) -> Void,
        schema: AnyMap?,
        options: NativeGenerationOptions?
    ) throws -> Promise<String> {
        state.withLock { $0.usage.beginRequest() }
        guard let document = schema?.schemaDocument() else {
            guard !Self.isEmpty(prompt) else { return Promise.resolved(withResult: "") }
            return generate(prompt, during: .streaming, options: options) { session, prompt, generationOptions in
                let last = try await consumeStreamingResponse(
                    session.streamResponse(to: prompt, options: generationOptions, reasoningLevel: options?.reasoningLevel)
                ) { onStream($0.content) }
                return (last?.content ?? "", last?.tokenUsage)
            }
        }
        return generate(prompt, during: .streaming, options: options) { session, prompt, generationOptions in
            let generationSchema = try GenerationSchemaBuilder.responseSchema(from: document)
            let last = try await consumeStreamingResponse(
                session.streamResponse(
                    to: prompt,
                    schema: generationSchema,
                    options: generationOptions,
                    reasoningLevel: options?.reasoningLevel
                )
            ) { onStream($0.content.jsonString) }
            return (last?.content.jsonString ?? "", last?.tokenUsage)
        }
    }

    @available(iOS 26.0, *)
    private func generate(
        _ prompt: NativePrompt,
        during operation: GenerationOperation,
        options: NativeGenerationOptions?,
        _ request: @escaping (LanguageModelSession, Prompt, GenerationOptions) async throws -> (String, NativeTokenUsage?)
    ) -> Promise<String> {
        return Promise.async {
            let generationOptions = try GenerationOptions(options)
            try self.ensureModelIsAvailable()
            let modelPrompt = try self.model.prompt(from: prompt)
            let modelSession = try self.beginResponse()
            defer { self.endResponse() }

            do {
                let (content, usage) = try await request(modelSession, modelPrompt, generationOptions)
                self.state.withLock { $0.usage.finishRequest(using: usage) }
                return content
            } catch {
                throw try await self.failure(from: error, during: operation, in: modelSession)
            }
        }
    }

    private static func isEmpty(_ prompt: NativePrompt) -> Bool {
        prompt.images.isEmpty && prompt.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    @available(iOS 26.0, *)
    var wasContextReset: Bool {
        state.withLock { $0.wasContextReset }
    }

    @available(iOS 26.0, *)
    var usage: NativeTokenUsage? {
        state.withLock { $0.usage.total(adding: $0.session.tokenUsage) }
    }

    @available(iOS 26.0, *)
    var lastResponseUsage: NativeTokenUsage? {
        state.withLock { $0.usage.lastResponse }
    }

    @available(iOS 26.0, *)
    func serializeTranscript() throws -> String {
        try TranscriptCoding.encode(state.withLock { $0.session.transcript })
    }

    @available(iOS 26.0, *)
    func prewarm(promptPrefix: String?) throws {
        state.withLock { $0.session }.prewarm(promptPrefix: promptPrefix.map { Prompt($0) })
    }

    /**
     * Returns the number of tokens the provided prompt consumes for this session's model.
     *
     * Note: `SystemLanguageModel.tokenCount(for:)` is only available starting iOS 26.4.
     */
    @available(iOS 26.0, *)
    func tokenCount(prompt: NativePrompt) throws -> Promise<Double> {
        return Promise.async {
            if #available(iOS 26.4, *) {
                let modelPrompt = try self.model.prompt(from: prompt)
                do {
                    let count = try await self.model.tokenCount(for: modelPrompt)
                    return Double(count)
                } catch {
                    throw AppleAIError.tokenCountError(error)
                }
            } else {
                throw AppleAIError.unsupportedPlatform("tokenCount requires iOS 26.4 or later")
            }
        }
    }
    
    @available(iOS 26.0, *)
    private func recoverFromContextOverflow(previousSession: LanguageModelSession) async throws {
        do {
            let summarySession = LanguageModelSession(model: self.model, transcript: previousSession.transcript)
            let summaryResponse = try await summarySession.respond(to: "Summarize this conversation in a concise way that preserves the key context and information.")
            let newSession = LanguageModelSession(
                model: self.model,
                tools: self.tools,
                instructions: SessionInstructions.withSummary(baseInstructions, summary: summaryResponse.content)
            )
            state.withLock { state in
                state.usage.retire(previousSession.tokenUsage)
                state.usage.retire(summarySession.tokenUsage)
                state.session = newSession
                state.wasContextReset = true
            }
        } catch {
            throw AppleAIError.contextRecoveryFailed(error)
        }
    }

    @available(iOS 26.0, *)
    private func failure(
        from error: any Error,
        during operation: GenerationOperation,
        in previousSession: LanguageModelSession
    ) async throws -> AppleAIError {
        let failure = AppleAIError(generationFailure: error, during: operation)
        if AppleAIError.requiresContextRecovery(after: error) {
            try await recoverFromContextOverflow(previousSession: previousSession)
        }
        return failure
    }

    @available(iOS 26.0, *)
    private func ensureModelIsAvailable() throws {
        switch model.availability {
        case .available:
            return
        case .unavailable(.deviceNotEligible):
            throw AppleAIError.modelUnavailable("this device is not eligible for Apple Intelligence")
        case .unavailable(.appleIntelligenceNotEnabled):
            throw AppleAIError.modelUnavailable("Apple Intelligence is not enabled")
        case .unavailable(.modelNotReady):
            throw AppleAIError.modelUnavailable("the model is not ready")
        case .unavailable(let reason):
            throw AppleAIError.modelUnavailable("unknown reason (\(reason))")
        }
    }

    @available(iOS 26.0, *)
    private func beginResponse() throws -> LanguageModelSession {
        try state.withLock { state in
            guard !state.isResponding && !state.session.isResponding else {
                throw AppleAIError.sessionBusy
            }
            state.isResponding = true
            return state.session
        }
    }

    @available(iOS 26.0, *)
    private func endResponse() {
        state.withLock { $0.isResponding = false }
    }
}
