import Foundation
import NitroModules

extension AnyMap {
    func schemaDocument() -> [String: Any] {
        var dictionary: [String: Any] = [:]
        for key in getAllKeys() {
            dictionary[key] = getAny(key: key) ?? NSNull()
        }
        return dictionary
    }
}
