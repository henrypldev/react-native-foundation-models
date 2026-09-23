import NitroModules
import FoundationModels

@available(iOS 26.0, *)
class HybridLanguageModelSession: HybridLanguageModelSessionSpec {
    private var session: LanguageModelSession? = nil
    private var isResponding: Bool = false
    private var tools: [any Tool] = []
    private var jsTools: [ToolDefinition] = []
    private var contextWasReset: Bool = false
    private let model: SystemLanguageModel
    private let stateLock = NSLock()
    
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
        
        let enhancedInstructions = Self.buildEnhancedInstructions(
            baseInstructions: config.instructions, 
            tools: jsTools
        )
        
        let session = LanguageModelSession(
            model: model,
            tools: tools,
            instructions: enhancedInstructions
        )
        self.model = model
        self.session = session
        self.tools = tools
        self.jsTools = jsTools
    }
    
    /**
     * Generates a non-streaming response and resolves with the final content.
     */
    @available(iOS 26.0, *)
    func respond(prompt: String, options: NativeGenerationOptions?) throws -> Promise<String> {
        return Promise.async {
            guard let modelSession = self.session else {
                throw AppleAIError.sessionNotInitialized
            }

            guard !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                return ""
            }

            let generationOptions = try GenerationOptions(options)
            try self.ensureModelIsAvailable()
            try self.beginResponse(using: modelSession)
            defer { self.endResponse() }

            do {
                let result = try await modelSession.respond(to: prompt, options: generationOptions)
                return result.content
            } catch {
                throw try await self.failure(from: error, during: .response, in: modelSession)
            }
        }
    }

    /**
     * Implements the streaming response functionality required by the Nitro interface.
     * This method bridges the FoundationModels streaming API with the Nitro callback system.
     */
    @available(iOS 26.0, *)
    func streamResponse(prompt: String, onStream: @escaping (String) -> Void, options: NativeGenerationOptions?) throws -> Promise<String> {
        return Promise.async {
            guard let modelSession = self.session else {
                throw AppleAIError.sessionNotInitialized
            }
            
            guard !prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
                return ""
            }
            
            let generationOptions = try GenerationOptions(options)
            try self.ensureModelIsAvailable()
            try self.beginResponse(using: modelSession)
            defer { self.endResponse() }
            
            do {
                let stream = modelSession.streamResponse(to: prompt, options: generationOptions)
                return try await consumeStreamingResponse(
                    stream,
                    content: { $0.content },
                    onContent: onStream
                )
            } catch {
                throw try await self.failure(from: error, during: .streaming, in: modelSession)
            }
        }
    }
    
    @available(iOS 26.0, *)
    var wasContextReset: Bool {
        return contextWasReset
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
        let enhancedInstructions = Self.buildEnhancedInstructions(
            baseInstructions: "You are a helpful assistant. Previous conversation summary: \(summaryResponse.content)",
            tools: self.jsTools
        )
        
        return LanguageModelSession(
            model: self.model,
            tools: self.tools,
            instructions: enhancedInstructions
        )
    }

    @available(iOS 26.0, *)
    private func recoverFromContextOverflow(previousSession: LanguageModelSession) async throws {
        do {
            let newSession = try await self.createNewSessionWithSummary(previousSession: previousSession)
            self.session = newSession
            self.contextWasReset = true
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
    private func beginResponse(using modelSession: LanguageModelSession) throws {
        stateLock.lock()
        defer { stateLock.unlock() }

        guard !isResponding && !modelSession.isResponding else {
            throw AppleAIError.sessionBusy
        }

        isResponding = true
    }

    private func endResponse() {
        stateLock.lock()
        isResponding = false
        stateLock.unlock()
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

/**
 * Custom configuration that uses HybridTool instead of HybridToolSpec
 */
@available(iOS 26.0, *)
struct CustomLanguageModelSessionConfig {
    let instructions: String?
    let tools: [HybridTool]?
    
    init(instructions: String? = nil, tools: [HybridTool]? = nil) {
        self.instructions = instructions
        self.tools = tools
    }
}
