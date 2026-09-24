import { z } from 'zod'
import { ResponseValidationError } from './errors'
import type { ObjectSchema } from './generation-schema'
import type { GenerationOptions } from './types'

/**
 * Options for a request whose response must match a Zod object schema.
 */
export interface StructuredGenerationOptions<S extends ObjectSchema>
  extends GenerationOptions {
  /**
   * The Zod object schema that constrains the response. The model generates
   * only values that fit it, and the final value is parsed with it.
   */
  schema: S
}

/**
 * A structured response while the model is still generating it. Any field can
 * be missing, and any string can be incomplete. This includes enum and literal
 * values, which can be `''` before the model picks one.
 */
export type DeepPartial<T> = T extends string
  ? string
  : T extends readonly (infer Element)[]
    ? DeepPartial<Element>[]
    : T extends object
      ? { [Key in keyof T]?: DeepPartial<T[Key]> }
      : T

export function parseResponseJson(json: string): unknown {
  try {
    return JSON.parse(json)
  } catch (error) {
    throw new ResponseValidationError('the model output is not valid JSON', {
      response: json,
      originalError: error,
    })
  }
}

export function parseResponse<S extends ObjectSchema>(
  schema: S,
  json: string,
): z.infer<S> {
  const value = parseResponseJson(json)
  const result = schema.safeParse(value)
  if (!result.success) {
    throw new ResponseValidationError(z.prettifyError(result.error), {
      issues: result.error.issues,
      response: value,
    })
  }
  return result.data
}
