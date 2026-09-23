import FoundationModels

@available(iOS 26.0, *)
extension LanguageModelSession {
    func respond(
        to prompt: String,
        options: GenerationOptions,
        native: NativeGenerationOptions?
    ) async throws -> Response<String> {
        #if compiler(>=6.4)
        if #available(iOS 27.0, *) {
            return try await respond(to: prompt, options: options, contextOptions: ContextOptions(native))
        }
        #endif
        return try await respond(to: prompt, options: options)
    }

    func respond(
        to prompt: String,
        schema: GenerationSchema,
        options: GenerationOptions,
        native: NativeGenerationOptions?
    ) async throws -> Response<GeneratedContent> {
        #if compiler(>=6.4)
        if #available(iOS 27.0, *) {
            return try await respond(
                to: prompt,
                schema: schema,
                options: options,
                contextOptions: ContextOptions(native, includeSchemaInPrompt: true)
            )
        }
        #endif
        return try await respond(to: prompt, schema: schema, options: options)
    }

    func streamResponse(
        to prompt: String,
        options: GenerationOptions,
        native: NativeGenerationOptions?
    ) -> ResponseStream<String> {
        #if compiler(>=6.4)
        if #available(iOS 27.0, *) {
            return streamResponse(to: prompt, options: options, contextOptions: ContextOptions(native))
        }
        #endif
        return streamResponse(to: prompt, options: options)
    }

    func streamResponse(
        to prompt: String,
        schema: GenerationSchema,
        options: GenerationOptions,
        native: NativeGenerationOptions?
    ) -> ResponseStream<GeneratedContent> {
        #if compiler(>=6.4)
        if #available(iOS 27.0, *) {
            return streamResponse(
                to: prompt,
                schema: schema,
                options: options,
                contextOptions: ContextOptions(native, includeSchemaInPrompt: true)
            )
        }
        #endif
        return streamResponse(to: prompt, schema: schema, options: options)
    }

    var tokenUsage: NativeTokenUsage? {
        #if compiler(>=6.4)
        if #available(iOS 27.0, *) {
            return NativeTokenUsage(usage)
        }
        #endif
        return nil
    }
}

@available(iOS 26.0, *)
extension LanguageModelSession.Response {
    var tokenUsage: NativeTokenUsage? {
        #if compiler(>=6.4)
        if #available(iOS 27.0, *) {
            return NativeTokenUsage(usage)
        }
        #endif
        return nil
    }
}

@available(iOS 26.0, *)
extension LanguageModelSession.ResponseStream.Snapshot {
    var tokenUsage: NativeTokenUsage? {
        #if compiler(>=6.4)
        if #available(iOS 27.0, *) {
            return NativeTokenUsage(usage)
        }
        #endif
        return nil
    }
}
