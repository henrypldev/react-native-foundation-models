import type { AnyMap } from 'react-native-nitro-modules'
import { z } from 'zod'
import { SchemaCreationError } from './errors'

/**
 * A Zod object schema. Tool arguments and structured responses must use an
 * object at the root.
 */
export type ObjectSchema = z.ZodObject

type JsonSchema = Record<string, unknown>

/**
 * Keywords that are part of the model-facing contract and are forwarded to
 * native code. Anything else is either metadata (dropped) or unsupported
 * (rejected), so the schema the model sees always matches what Zod validates.
 */
export const KEYWORDS = {
  object: ['type', 'description', 'properties', 'required'],
  array: ['type', 'description', 'items', 'minItems', 'maxItems'],
  string: ['type', 'description', 'enum', 'const'],
  number: ['type', 'description', 'minimum', 'maximum'],
  integer: ['type', 'description', 'minimum', 'maximum'],
  boolean: ['type', 'description'],
} as const

const DROPPED_KEYWORDS = new Set(['$schema', 'default', 'id', '$id'])

export const UNSUPPORTED_HINTS: Record<string, string> = {
  exclusiveMinimum: 'use an inclusive bound such as .min()/.gte() instead of .gt()',
  exclusiveMaximum: 'use an inclusive bound such as .max()/.lte() instead of .lt()',
  pattern:
    'Foundation Models cannot enforce regex patterns; validate in the handler or use .describe()',
  format:
    'string formats such as .email() are not supported; use z.string() and validate in the handler',
  prefixItems: 'tuples are not supported; use z.array() of a single element type',
  additionalProperties:
    'dynamic keys (z.record) are not supported; declare explicit properties',
  propertyNames: 'dynamic keys (z.record) are not supported; declare explicit properties',
  anyOf:
    'unions are not supported; use a single type, or z.enum([...]) for string choices',
  oneOf:
    'unions are not supported; use a single type, or z.enum([...]) for string choices',
  allOf: 'intersections are not supported; flatten into a single object schema',
  not: 'negated schemas are not supported',
  multipleOf: 'multipleOf is not supported; validate in the handler',
}

const SUPPORTED_TYPES_HINT =
  'supported types are string, number, integer, boolean, object, and array'

function unsupported(path: string, what: string, hint?: string): SchemaCreationError {
  const suggestion = hint ? ` (${hint})` : ''
  return new SchemaCreationError(
    `Property '${path}' uses unsupported schema feature: ${what}${suggestion}`,
    { path, feature: what },
  )
}

function isNullSchema(schema: unknown): boolean {
  return (
    typeof schema === 'object' &&
    schema !== null &&
    (schema as JsonSchema).type === 'null'
  )
}

/**
 * Unwraps `anyOf: [X, { type: 'null' }]`, which Zod emits for `.nullish()` and
 * `.nullable()`. Foundation Models has no null type: an omitted key is the only
 * way the model can express "no value". `.nullish()` fields parse when the key
 * is missing, so they stay supported as optional; a required `.nullable()`
 * field would fail Zod parsing on a missing key, so it is rejected.
 */
function unwrapNullUnion(
  schema: JsonSchema,
  path: string,
  isRequired: boolean,
): JsonSchema {
  const anyOf = schema.anyOf
  if (!Array.isArray(anyOf)) {
    return schema
  }

  const nonNull = anyOf.filter(branch => !isNullSchema(branch))
  if (nonNull.length === anyOf.length || nonNull.length !== 1) {
    throw unsupported(path, 'anyOf', UNSUPPORTED_HINTS.anyOf)
  }

  if (path.endsWith('[]')) {
    throw unsupported(
      path,
      'a nullable array element',
      'the model cannot emit null; remove .nullable()/.nullish() from the array element type',
    )
  }

  if (isRequired) {
    throw unsupported(
      path,
      'a required nullable field',
      'the model cannot emit null; use .nullish() or .optional() so the field may be omitted instead',
    )
  }

  const rest: JsonSchema = { ...schema }
  delete rest.anyOf
  return { ...rest, ...(nonNull[0] as JsonSchema) }
}

function sanitizeSchema(node: JsonSchema, path: string, isRequired: boolean): JsonSchema {
  const schema = unwrapNullUnion(node, path, isRequired)

  const type = schema.type
  if (typeof type !== 'string' || !(type in KEYWORDS)) {
    throw unsupported(path, `type '${String(type ?? 'unknown')}'`, SUPPORTED_TYPES_HINT)
  }

  const allowed = KEYWORDS[type as keyof typeof KEYWORDS] as readonly string[]
  const sanitized: JsonSchema = {}

  for (const [keyword, value] of Object.entries(schema)) {
    if (DROPPED_KEYWORDS.has(keyword)) {
      continue
    }
    if (keyword === 'additionalProperties' && value === false) {
      continue
    }
    if (!allowed.includes(keyword)) {
      throw unsupported(path, `keyword '${keyword}'`, UNSUPPORTED_HINTS[keyword])
    }
  }

  sanitized.type = type
  if (typeof schema.description === 'string') {
    sanitized.description = schema.description
  }

  switch (type) {
    case 'object': {
      const properties = (schema.properties ?? {}) as Record<string, JsonSchema>
      const required = Array.isArray(schema.required) ? (schema.required as string[]) : []
      const sanitizedProperties: JsonSchema = {}
      for (const [key, propertySchema] of Object.entries(properties)) {
        sanitizedProperties[key] = sanitizeSchema(
          propertySchema,
          `${path}.${key}`,
          required.includes(key),
        )
      }
      sanitized.properties = sanitizedProperties
      if (required.length > 0) {
        sanitized.required = required
      }
      break
    }
    case 'array': {
      if (typeof schema.items !== 'object' || schema.items === null) {
        throw unsupported(path, 'an array without a single element schema')
      }
      sanitized.items = sanitizeSchema(schema.items as JsonSchema, `${path}[]`, true)
      if (typeof schema.minItems === 'number') {
        sanitized.minItems = schema.minItems
      }
      if (typeof schema.maxItems === 'number') {
        sanitized.maxItems = schema.maxItems
      }
      break
    }
    case 'string': {
      if (schema.enum !== undefined) {
        const values = schema.enum
        if (!Array.isArray(values) || values.some(value => typeof value !== 'string')) {
          throw unsupported(path, 'a non-string enum', 'only string enums are supported')
        }
        sanitized.enum = values
      }
      if (schema.const !== undefined) {
        if (typeof schema.const !== 'string') {
          throw unsupported(
            path,
            'a non-string literal',
            'only string literals are supported',
          )
        }
        sanitized.const = schema.const
      }
      break
    }
    case 'number':
    case 'integer': {
      if (schema.enum !== undefined || schema.const !== undefined) {
        throw unsupported(
          path,
          'a numeric enum or literal',
          'only string enums and literals are supported',
        )
      }
      if (typeof schema.minimum === 'number') {
        sanitized.minimum = schema.minimum
      }
      if (typeof schema.maximum === 'number') {
        sanitized.maximum = schema.maximum
      }
      break
    }
    default:
      break
  }

  return sanitized
}

export function toGenerationSchema(schema: ObjectSchema, errorPathRoot: string): AnyMap {
  let jsonSchema: JsonSchema
  try {
    jsonSchema = z.toJSONSchema(schema, { io: 'input' }) as JsonSchema
  } catch (error) {
    throw new SchemaCreationError(
      `Schema cannot be represented as JSON Schema: ${
        error instanceof Error ? error.message : String(error)
      }`,
      { originalError: error },
    )
  }

  if (jsonSchema.type !== 'object') {
    throw unsupported(
      errorPathRoot,
      `a root of type '${String(jsonSchema.type)}'`,
      'use z.object()',
    )
  }

  return sanitizeSchema(jsonSchema, errorPathRoot, true) as AnyMap
}
