import Foundation
import FoundationModels

@available(iOS 26.0, macOS 26.0, *)
enum ToolContent {
    static func arguments(from content: GeneratedContent) throws -> [String: Any?] {
        guard case .structure(let properties, let orderedKeys) = content.kind else {
            throw AppleAIError.argumentParsingError(
                "Expected tool arguments to be an object, got \(content.kind)"
            )
        }
        return structureValues(properties, orderedKeys: orderedKeys)
    }

    private static func structureValues(
        _ properties: [String: GeneratedContent], orderedKeys: [String]
    ) -> [String: Any?] {
        var object: [String: Any?] = [:]
        for key in orderedKeys {
            guard let property = properties[key] else { continue }
            object[key] = anyValue(from: property)
        }
        return object
    }

    private static func anyValue(from content: GeneratedContent) -> Any? {
        switch content.kind {
        case .null:
            return nil
        case .bool(let boolValue):
            return boolValue
        case .number(let doubleValue):
            return doubleValue
        case .string(let stringValue):
            return stringValue
        case .array(let elements):
            return elements.map { anyValue(from: $0) }
        case .structure(let properties, let orderedKeys):
            return structureValues(properties, orderedKeys: orderedKeys)
        @unknown default:
            return nil
        }
    }

    static func generatedContent(fromResult result: [String: Any?]) throws -> GeneratedContent {
        return GeneratedContent(kind: try kind(fromValue: result, path: ""))
    }

    private static func kind(fromValue value: Any?, path: String) throws -> GeneratedContent.Kind {
        switch value {
        case nil, is NSNull:
            return .null
        case let boolValue as Bool:
            return .bool(boolValue)
        case let intValue as Int:
            return .number(Double(intValue))
        case let int64Value as Int64:
            return .number(Double(int64Value))
        case let doubleValue as Double:
            return .number(doubleValue)
        case let floatValue as Float:
            return .number(Double(floatValue))
        case let stringValue as String:
            return .string(stringValue)
        case let dictionary as [String: Any?]:
            let orderedKeys = Array(dictionary.keys)
            var properties: [String: GeneratedContent] = [:]
            for key in orderedKeys {
                let childPath = path.isEmpty ? key : "\(path).\(key)"
                properties[key] = try GeneratedContent(
                    kind: kind(fromValue: dictionary[key] ?? nil, path: childPath)
                )
            }
            return .structure(properties: properties, orderedKeys: orderedKeys)
        case let array as [Any?]:
            let elements = try array.enumerated().map { index, element in
                try GeneratedContent(kind: kind(fromValue: element, path: "\(path)[\(index)]"))
            }
            return .array(elements)
        default:
            throw AppleAIError.responseParsingError(
                "Tool result field '\(path)' has unsupported value of type \(type(of: value ?? "nil"))"
            )
        }
    }
}
