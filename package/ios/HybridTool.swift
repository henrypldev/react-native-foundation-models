import Foundation
import NitroModules
import FoundationModels

@available(iOS 26.0, *)
struct HybridTool: Tool, @unchecked Sendable {
    var name: String
    var description: String
    var parameters: GenerationSchema
    var handler: (AnyMap) -> Promise<Promise<AnyMap>>

    @available(iOS 26.0, *)
    init(name: String, description: String, parameters: AnyMap, handler: @escaping (AnyMap) -> Promise<Promise<AnyMap>>) throws {
        self.name = name
        self.description = description
        self.handler = handler
        do {
            self.parameters = try GenerationSchemaBuilder.toolParameters(from: parameters.schemaDocument())
        } catch {
            throw AppleAIError.schemaCreationError("Failed to create schema for tool '\(name)': \(error.localizedDescription)")
        }
    }

    @available(iOS 26.0, *)
    func call(arguments: GeneratedContent) async throws -> some Generable {
        do {
            let argumentsMap = try Self.anyMap(fromArguments: ToolContent.arguments(from: arguments))
            let resultPromise = handler(argumentsMap)

            let result: Promise<AnyMap>
            do {
                result = try await resultPromise.await()
            } catch {
                throw AppleAIError.toolExecutionError(name, error)
            }

            let resultMap: AnyMap
            do {
                resultMap = try await result.await()
            } catch {
                throw AppleAIError.toolExecutionError(name, error)
            }

            return try ToolContent.generatedContent(
                fromResult: Self.resultDictionary(from: resultMap)
            )
        } catch let error as AppleAIError {
            throw error
        } catch {
            throw AppleAIError.toolCallError(error)
        }
    }

    // MARK: - AnyMap bridging

    @available(iOS 26.0, *)
    private static func resultDictionary(from anyMap: AnyMap) -> [String: Any?] {
        var dictionary: [String: Any?] = [:]
        for key in anyMap.getAllKeys() {
            dictionary[key] = anyMap.getAny(key: key)
        }
        return dictionary
    }

    @available(iOS 26.0, *)
    private static func anyMap(fromArguments arguments: [String: Any?]) throws -> AnyMap {
        let map = AnyMap()
        for (key, value) in arguments {
            switch try anyValue(from: value, path: key) {
            case .null:
                map.setNull(key: key)
            case .bool(let boolValue):
                map.setBoolean(key: key, value: boolValue)
            case .number(let doubleValue):
                map.setDouble(key: key, value: doubleValue)
            case .int64(let int64Value):
                map.setInt64(key: key, value: int64Value)
            case .string(let stringValue):
                map.setString(key: key, value: stringValue)
            case .array(let elements):
                map.setArray(key: key, value: elements)
            case .object(let object):
                map.setObject(key: key, value: object)
            }
        }
        return map
    }

    @available(iOS 26.0, *)
    private static func anyValue(from value: Any?, path: String) throws -> AnyValue {
        switch value {
        case nil, is NSNull:
            return .null
        case let boolValue as Bool:
            return .bool(boolValue)
        case let doubleValue as Double:
            return .number(doubleValue)
        case let stringValue as String:
            return .string(stringValue)
        case let elements as [Any?]:
            return .array(try elements.enumerated().map { index, element in
                try anyValue(from: element, path: "\(path)[\(index)]")
            })
        case let object as [String: Any?]:
            var converted: [String: AnyValue] = [:]
            for (childKey, childValue) in object {
                converted[childKey] = try anyValue(from: childValue, path: "\(path).\(childKey)")
            }
            return .object(converted)
        default:
            throw AppleAIError.argumentParsingError(
                "Tool argument '\(path)' has unsupported value of type \(type(of: value ?? "nil"))"
            )
        }
    }
}
