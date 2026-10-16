import type { AnyMap } from 'react-native-nitro-modules'
import { z } from 'zod'
import {
  ArgumentParsingError,
  parseNativeError,
  ResponseParsingError,
  SchemaCreationError,
} from './errors'
import { type ObjectSchema, toGenerationSchema } from './generation-schema'
import type { ToolDefinition } from './specs/LanguageModelSession.nitro'

export interface TypeSafeToolDefinition<T extends ObjectSchema> {
  name: string
  description: string
  arguments: T
  handler: (args: z.infer<T>) => Promise<AnyMap>
}

/**
 * Creates a type-safe tool definition whose advertised schema matches the Zod
 * validation schema exactly. Unsupported schema features fail here, at tool
 * creation time, instead of silently degrading at call time.
 */
export function createTool<T extends ObjectSchema>(
  definition: TypeSafeToolDefinition<T>,
): ToolDefinition {
  try {
    const argumentsSchema = toGenerationSchema(definition.arguments, 'arguments')

    return {
      name: definition.name,
      description: definition.description,
      arguments: argumentsSchema,
      handler: async (args: AnyMap) => {
        try {
          // Parse and validate the arguments using Zod
          const parsedArgs = definition.arguments.parse(args)

          // Call the type-safe handler
          const result = await definition.handler(parsedArgs)

          // Validate that result is AnyMap-compatible
          if (result === null || result === undefined) {
            throw new ResponseParsingError('Tool handler returned null or undefined')
          }

          if (typeof result !== 'object') {
            throw new ResponseParsingError(
              `Tool handler must return an object, got ${typeof result}`,
              { returnedType: typeof result, returnedValue: result },
            )
          }

          // Return the result (convert to AnyMap if needed)
          return result as AnyMap
        } catch (error) {
          if (error instanceof z.ZodError) {
            throw new ArgumentParsingError(
              `Invalid arguments for tool '${definition.name}'`,
              {
                toolName: definition.name,
                zodErrors: error.issues,
                receivedArgs: args,
              },
            )
          }

          if (
            error instanceof ArgumentParsingError ||
            error instanceof ResponseParsingError
          ) {
            throw error
          }

          // Handle handler errors
          throw parseNativeError(error)
        }
      },
    }
  } catch (error) {
    if (error instanceof SchemaCreationError) {
      throw error
    }
    throw new SchemaCreationError(`Failed to create tool '${definition.name}'`, {
      toolName: definition.name,
      originalError: error,
    })
  }
}
