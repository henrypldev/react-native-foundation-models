import NitroModules
import FoundationModels
import Synchronization

@available(iOS 26.0, *)
private struct SessionState {
    var session: LanguageModelSession
    var isResponding = false
    var wasContextReset = false
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
        
        let session: LanguageModelSession
        let baseInstructions: String
        if let transcript = config.transcript {
            let decoded = try TranscriptCoding.decode(transcript)
            session = LanguageModelSession(model: model, tools: tools, transcript: decoded)
            baseInstructions = TranscriptCoding.instructionsText(in: decoded)
                ?? Self.buildEnhancedInstructions(baseInstructions: nil, tools: jsTools)
        } else {
            baseInstructions = Self.buildEnhancedInstructions(baseInstructions: config.instructions, tools: jsTools)
            session = LanguageModelSession(model: model, tools: tools, instructions: baseInstructions)
        }
        self.model = model
        self.state = Mutex(SessionState(session: session))
        self.tools = tools
        self.baseInstructions = baseInstructions
    }
    
    @available(iOS 26.0, *)
    func respond(prompt: String, schema: AnyMap?, options: NativeGenerationOptions?) throws -> Promise<String> {
        guard let document = schema?.schemaDocument() else {
            guard !Self.isBlank(prompt) else { return Promise.resolved(withResult: "") }
            return generate(during: .response, options: options) { session, generationOptions in
                try await session.respond(to: prompt, options: generationOptions).content
            }
        }
        return generate(during: .response, options: options) { session, generationOptions in
            let generationSchema = try GenerationSchemaBuilder.responseSchema(from: document)
            return try await session.respond(to: prompt, schema: generationSchema, options: generationOptions)
                .content.jsonString
        }
    }

    @available(iOS 26.0, *)
    func streamResponse(
        prompt: String,
        onStream: @escaping (String) -> Void,
        schema: AnyMap?,
        options: NativeGenerationOptions?
    ) throws -> Promise<String> {
        guard let document = schema?.schemaDocument() else {
            guard !Self.isBlank(prompt) else { return Promise.resolved(withResult: "") }
            return generate(during: .streaming, options: options) { session, generationOptions in
                try await consumeStreamingResponse(
                    session.streamResponse(to: prompt, options: generationOptions),
                    content: { $0.content },
                    onContent: onStream
                )
            }
        }
        return generate(during: .streaming, options: options) { session, generationOptions in
            let generationSchema = try GenerationSchemaBuilder.responseSchema(from: document)
            return try await consumeStreamingResponse(
                session.streamResponse(to: prompt, schema: generationSchema, options: generationOptions),
                content: { $0.content.jsonString },
                onContent: onStream
            )
        }
    }

    @available(iOS 26.0, *)
    private func generate(
        during operation: GenerationOperation,
        options: NativeGenerationOptions?,
        _ request: @escaping (LanguageModelSession, GenerationOptions) async throws -> String
    ) -> Promise<String> {
        return Promise.async {
            let generationOptions = try GenerationOptions(options)
            try self.ensureModelIsAvailable()
            let modelSession = try self.beginResponse()
            defer { self.endResponse() }

            do {
                return try await request(modelSession, generationOptions)
            } catch {
                throw try await self.failure(from: error, during: operation, in: modelSession)
            }
        }
    }

    private static func isBlank(_ prompt: String) -> Bool {
        prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    @available(iOS 26.0, *)
    var wasContextReset: Bool {
        state.withLock { $0.wasContextReset }
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
    func tokenCount(prompt: String) throws -> Promise<Double> {
        return Promise.async {
            if #available(iOS 26.4, *) {
                do {
                    let count = try await self.model.tokenCount(for: prompt)
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
    private func createNewSessionWithSummary(previousSession: LanguageModelSession) async throws -> LanguageModelSession {
        let summarySession = LanguageModelSession(model: self.model, transcript: previousSession.transcript)
        let summaryResponse = try await summarySession.respond(to: "Summarize this conversation in a concise way that preserves the key context and information.")
        return LanguageModelSession(
            model: self.model,
            tools: self.tools,
            instructions: "\(baseInstructions)\n\nPrevious conversation summary: \(summaryResponse.content)"
        )
    }

    @available(iOS 26.0, *)
    private func recoverFromContextOverflow(previousSession: LanguageModelSession) async throws {
        do {
            let newSession = try await self.createNewSessionWithSummary(previousSession: previousSession)
            state.withLock { state in
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
        if case .contextExceeded = failure {
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

    @available(iOS 26.0, *)
    private static func buildEnhancedInstructions(baseInstructions: String?, tools: [ToolDefinition]) -> String {
        let base = baseInstructions ?? "You are a helpful assistant"
        
        guard !tools.isEmpty else {
            return base
        }
        
        let toolDescriptions = tools.map { tool in
            "- \(tool.name): \(tool.description)"
        }.joined(separator: "\n")
        
        return "\(base). You have access to these tools:\n\(toolDescriptions)"
    }
}

