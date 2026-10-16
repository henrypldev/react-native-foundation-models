import Foundation
import FoundationModels

@available(iOS 26.0, macOS 26.0, *)
enum GenerationSchemaBuilder {
    static let unsupportedKeywords: Set<String> = [
        "anyOf", "oneOf", "allOf", "not", "pattern", "format", "prefixItems",
        "propertyNames", "multipleOf", "exclusiveMinimum", "exclusiveMaximum",
        "$ref", "$defs",
    ]

    static func toolParameters(from document: [String: Any]) throws -> GenerationSchema {
        guard document["type"] as? String == "object" else {
            return try GenerationSchema(root: flatTypeNameSchema(from: document), dependencies: [])
        }
        return try schema(from: document, name: "ToolParameters", path: "arguments")
    }

    static func responseSchema(from document: [String: Any]) throws -> GenerationSchema {
        guard document["type"] as? String == "object" else {
            throw AppleAIError.schemaCreationError("The response schema must have an object at the root")
        }
        return try schema(from: document, name: "Response", path: "response")
    }

    private static func schema(from document: [String: Any], name: String, path: String) throws -> GenerationSchema {
        try GenerationSchema(root: dynamicSchema(from: document, name: name, path: path), dependencies: [])
    }

    /// Dictionaries that crossed the Nitro bridge arrive as `[String: Any?]`;
    /// normalize both spellings into `[String: Any]`.
    private static func objectNode(_ value: Any?) -> [String: Any]? {
        if let dictionary = value as? [String: Any] {
            return dictionary
        }
        if let dictionary = value as? [String: Any?] {
            return dictionary.mapValues { $0 ?? NSNull() }
        }
        return nil
    }

    private static func stringArray(_ value: Any?) -> [String]? {
        if let strings = value as? [String] {
            return strings
        }
        if let elements = value as? [Any?] {
            let strings = elements.compactMap { $0 as? String }
            return strings.count == elements.count ? strings : nil
        }
        return nil
    }

    private static func dynamicSchema(
        from node: [String: Any], name: String, path: String
    ) throws -> DynamicGenerationSchema {
        for keyword in node.keys {
            if unsupportedKeywords.contains(keyword) {
                throw AppleAIError.schemaCreationError(
                    "Property '\(path)' uses unsupported schema keyword '\(keyword)'"
                )
            }
        }
        if let additional = node["additionalProperties"], (additional as? Bool) != false {
            throw AppleAIError.schemaCreationError(
                "Property '\(path)' uses dynamic keys, which are not supported"
            )
        }

        let description = node["description"] as? String
        let type = node["type"] as? String

        if type != "string", node["enum"] != nil || node["const"] != nil {
            throw AppleAIError.schemaCreationError(
                "Property '\(path)' uses a non-string enum or literal, which is not supported"
            )
        }

        switch type {
        case "object":
            let properties = objectNode(node["properties"]) ?? [:]
            let required = Set(stringArray(node["required"]) ?? [])
            let schemaProperties = try properties.keys.sorted().map { key -> DynamicGenerationSchema.Property in
                guard let childNode = objectNode(properties[key]) else {
                    throw AppleAIError.schemaCreationError(
                        "Property '\(path).\(key)' is not a schema object"
                    )
                }
                return DynamicGenerationSchema.Property(
                    name: key,
                    description: childNode["description"] as? String,
                    schema: try dynamicSchema(from: childNode, name: "\(path).\(key)", path: "\(path).\(key)"),
                    isOptional: !required.contains(key)
                )
            }
            return DynamicGenerationSchema(
                name: name, description: description, properties: schemaProperties
            )

        case "array":
            guard let items = objectNode(node["items"]) else {
                throw AppleAIError.schemaCreationError(
                    "Property '\(path)' is an array without a single element schema"
                )
            }
            var itemSchema = try dynamicSchema(from: items, name: "\(path)[]", path: "\(path)[]")
            // Primitive schemas have no description slot; a one-choice anyOf
            // wrapper carries the element description into the model contract.
            if let itemDescription = items["description"] as? String, lacksDescriptionSlot(items) {
                itemSchema = DynamicGenerationSchema(
                    name: "\(path)[]", description: itemDescription, anyOf: [itemSchema]
                )
            }
            return DynamicGenerationSchema(
                arrayOf: itemSchema,
                minimumElements: intBound(node["minItems"]),
                maximumElements: intBound(node["maxItems"])
            )

        case "string":
            if let values = node["enum"] {
                guard let choices = stringArray(values), !choices.isEmpty else {
                    throw AppleAIError.schemaCreationError(
                        "Property '\(path)' uses a non-string enum, which is not supported"
                    )
                }
                return DynamicGenerationSchema(name: name, description: description, anyOf: choices)
            }
            if let literal = node["const"] {
                guard let choice = literal as? String else {
                    throw AppleAIError.schemaCreationError(
                        "Property '\(path)' uses a non-string literal, which is not supported"
                    )
                }
                return DynamicGenerationSchema(name: name, description: description, anyOf: [choice])
            }
            return DynamicGenerationSchema(type: String.self)

        case "integer":
            return DynamicGenerationSchema(type: Int.self, guides: rangeGuides(
                minimum: intBound(node["minimum"]), maximum: intBound(node["maximum"]),
                min: { .minimum($0) }, max: { .maximum($0) }, range: { .range($0) }
            ))

        case "number":
            return DynamicGenerationSchema(type: Double.self, guides: rangeGuides(
                minimum: doubleBound(node["minimum"]), maximum: doubleBound(node["maximum"]),
                min: { .minimum($0) }, max: { .maximum($0) }, range: { .range($0) }
            ))

        case "boolean":
            return DynamicGenerationSchema(type: Bool.self)

        case let type:
            throw AppleAIError.schemaCreationError(
                "Property '\(path)' has unsupported type '\(type ?? "unknown")'"
            )
        }
    }

    private static func flatTypeNameSchema(from document: [String: Any]) throws -> DynamicGenerationSchema {
        let properties = try document.keys.sorted().map { key -> DynamicGenerationSchema.Property in
            guard let typeName = document[key] as? String else {
                throw AppleAIError.schemaCreationError(
                    "Property '\(key)' must be a type name string or a JSON Schema object"
                )
            }
            let schema: DynamicGenerationSchema
            switch typeName.lowercased() {
            case "string":
                schema = DynamicGenerationSchema(type: String.self)
            case "number", "double", "float":
                schema = DynamicGenerationSchema(type: Double.self)
            case "int", "integer":
                schema = DynamicGenerationSchema(type: Int.self)
            case "boolean", "bool":
                schema = DynamicGenerationSchema(type: Bool.self)
            default:
                throw AppleAIError.schemaCreationError(
                    "Property '\(key)' has unsupported type '\(typeName)'. Supported: string, number, boolean, integer, or a JSON Schema object"
                )
            }
            return DynamicGenerationSchema.Property(name: key, schema: schema)
        }
        return DynamicGenerationSchema(name: "ToolParameters", properties: properties)
    }

    private static func lacksDescriptionSlot(_ node: [String: Any]) -> Bool {
        switch node["type"] as? String {
        case "number", "integer", "boolean":
            return true
        case "string":
            return node["enum"] == nil && node["const"] == nil
        default:
            return false
        }
    }

    private static func rangeGuides<T>(
        minimum: T?, maximum: T?,
        min: (T) -> GenerationGuide<T>,
        max: (T) -> GenerationGuide<T>,
        range: (ClosedRange<T>) -> GenerationGuide<T>
    ) -> [GenerationGuide<T>] {
        switch (minimum, maximum) {
        case (let lower?, let upper?): return [range(lower...upper)]
        case (let lower?, nil): return [min(lower)]
        case (nil, let upper?): return [max(upper)]
        case (nil, nil): return []
        }
    }

    private static func intBound(_ value: Any?) -> Int? {
        switch value {
        case let intValue as Int: return intValue
        case let int64Value as Int64: return Int(exactly: int64Value)
        case let doubleValue as Double: return Int(exactly: doubleValue)
        default: return nil
        }
    }

    private static func doubleBound(_ value: Any?) -> Double? {
        switch value {
        case let doubleValue as Double: return doubleValue
        case let intValue as Int: return Double(intValue)
        case let int64Value as Int64: return Double(int64Value)
        default: return nil
        }
    }
}
