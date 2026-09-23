import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import { ArgumentParsingError, SchemaCreationError } from '../src/errors'
import { KEYWORDS, UNSUPPORTED_HINTS } from '../src/generation-schema'
import { createTool } from '../src/tool-utils'

const makeTool = <T extends z.ZodObject<any>>(
  args: T,
  handler: (parsed: z.infer<T>) => Promise<Record<string, unknown>> = async () => ({
    ok: true,
  }),
) =>
  createTool({
    name: 'test-tool',
    description: 'A tool used in tests',
    arguments: args,
    handler: handler as any,
  })

describe('createTool schema contract', () => {
  test('emits a JSON Schema document for flat primitive arguments', () => {
    const tool = makeTool(
      z.object({
        city: z.string(),
        temperature: z.number(),
        celsius: z.boolean(),
      }),
    )

    expect(tool.arguments).toEqual({
      type: 'object',
      properties: {
        city: { type: 'string' },
        temperature: { type: 'number' },
        celsius: { type: 'boolean' },
      },
      required: ['city', 'temperature', 'celsius'],
    })
  })

  test('preserves property descriptions', () => {
    const tool = makeTool(z.object({ city: z.string().describe('City name') }))

    expect(tool.arguments).toEqual({
      type: 'object',
      properties: { city: { type: 'string', description: 'City name' } },
      required: ['city'],
    })
  })

  test('keeps optional, defaulted, and nullish fields out of required', () => {
    const tool = makeTool(
      z.object({
        required: z.string(),
        optional: z.string().optional(),
        defaulted: z.string().default('fallback'),
        nullish: z.string().nullish(),
      }),
    )

    expect(tool.arguments).toEqual({
      type: 'object',
      properties: {
        required: { type: 'string' },
        optional: { type: 'string' },
        defaulted: { type: 'string' },
        nullish: { type: 'string' },
      },
      required: ['required'],
    })
  })

  test('recursively converts nested objects and arrays', () => {
    const tool = makeTool(
      z.object({
        location: z.object({
          lat: z.number(),
          lon: z.number(),
          label: z.string().optional(),
        }),
        tags: z.array(z.string()).min(1).max(5),
        points: z.array(z.object({ x: z.number(), y: z.number() })),
      }),
    )

    expect(tool.arguments).toEqual({
      type: 'object',
      properties: {
        location: {
          type: 'object',
          properties: {
            lat: { type: 'number' },
            lon: { type: 'number' },
            label: { type: 'string' },
          },
          required: ['lat', 'lon'],
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          minItems: 1,
          maxItems: 5,
        },
        points: {
          type: 'array',
          items: {
            type: 'object',
            properties: { x: { type: 'number' }, y: { type: 'number' } },
            required: ['x', 'y'],
          },
        },
      },
      required: ['location', 'tags', 'points'],
    })
  })

  test('converts string enums and string literals', () => {
    const tool = makeTool(
      z.object({
        units: z.enum(['celsius', 'fahrenheit']),
        mode: z.literal('forecast'),
      }),
    )

    expect(tool.arguments).toEqual({
      type: 'object',
      properties: {
        units: { type: 'string', enum: ['celsius', 'fahrenheit'] },
        mode: { type: 'string', const: 'forecast' },
      },
      required: ['units', 'mode'],
    })
  })

  test('preserves inclusive numeric and integer bounds', () => {
    const tool = makeTool(
      z.object({
        ratio: z.number().min(0).max(1),
        days: z.number().int().min(1).max(10),
      }),
    )

    expect(tool.arguments).toEqual({
      type: 'object',
      properties: {
        ratio: { type: 'number', minimum: 0, maximum: 1 },
        days: { type: 'integer', minimum: 1, maximum: 10 },
      },
      required: ['ratio', 'days'],
    })
  })

  test('strips metadata that is not part of the model-facing contract', () => {
    const tool = makeTool(z.strictObject({ units: z.enum(['c', 'f']).default('c') }))

    expect(tool.arguments).toEqual({
      type: 'object',
      properties: { units: { type: 'string', enum: ['c', 'f'] } },
    })
  })
})

describe('createTool schema rejection', () => {
  const expectRejection = (schema: z.ZodObject<any>, messagePattern: RegExp) => {
    let caught: unknown
    try {
      makeTool(schema)
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(SchemaCreationError)
    expect((caught as SchemaCreationError).message).toMatch(messagePattern)
  }

  test('rejects required nullable fields and suggests alternatives', () => {
    expectRejection(
      z.object({ city: z.string().nullable() }),
      /city.*nullish|nullish.*city/s,
    )
  })

  test('rejects unions', () => {
    expectRejection(z.object({ id: z.union([z.string(), z.number()]) }), /id/)
  })

  test('rejects records with dynamic keys', () => {
    expectRejection(z.object({ scores: z.record(z.string(), z.number()) }), /scores/)
  })

  test('rejects tuples', () => {
    expectRejection(z.object({ pair: z.tuple([z.string(), z.number()]) }), /pair/)
  })

  test('rejects string patterns and formats', () => {
    expectRejection(z.object({ code: z.string().regex(/^a+$/) }), /code.*pattern/s)
    expectRejection(z.object({ email: z.email() }), /email/)
  })

  test('rejects exclusive numeric bounds and suggests inclusive ones', () => {
    expectRejection(z.object({ count: z.number().gt(5) }), /count.*exclusiveMinimum/s)
    expectRejection(z.object({ count: z.number().lt(5) }), /count.*exclusiveMaximum/s)
  })

  test('rejects multipleOf', () => {
    expectRejection(z.object({ even: z.number().multipleOf(2) }), /even.*multipleOf/s)
  })

  test('rejects non-string literals and enums', () => {
    expectRejection(z.object({ version: z.literal(3) }), /version/)
    expectRejection(z.object({ level: z.enum({ Low: 1, High: 2 }) }), /level/)
  })

  test('rejects schemas Zod cannot represent in JSON Schema', () => {
    expectRejection(z.object({ when: z.date() }), /when|Date/)
  })

  test('rejects nested unsupported schemas and names the nested path', () => {
    expectRejection(
      z.object({ filters: z.object({ createdAfter: z.date() }) }),
      /filters|Date/,
    )
  })

  test('rejects nullable array elements with element-specific guidance', () => {
    expectRejection(
      z.object({ tags: z.array(z.string().nullable()) }),
      /tags\[\].*element/s,
    )
    expectRejection(
      z.object({ tags: z.array(z.string().nullish()) }),
      /tags\[\].*element/s,
    )
  })

  test('gives a supported-types hint for unknown schema types', () => {
    expectRejection(z.object({ x: z.any() }), /x.*supported types/is)
  })

  test('gives usable guidance for unions', () => {
    expectRejection(
      z.object({ id: z.union([z.string(), z.number()]) }),
      /id.*union.*(single|enum)/is,
    )
  })

  test('names the root as arguments for root-level violations', () => {
    expectRejection(
      z.object({ a: z.string() }).catchall(z.string()),
      /arguments.*additionalProperties/s,
    )
  })
})

describe('rejection keyword contract fixture', () => {
  const fixture: string[] = JSON.parse(
    readFileSync(
      join(import.meta.dir, 'fixtures/unsupported-schema-keywords.json'),
      'utf8',
    ),
  )

  test('every hinted keyword is in the shared fixture', () => {
    for (const keyword of Object.keys(UNSUPPORTED_HINTS)) {
      expect(fixture).toContain(keyword)
    }
  })

  test('no fixture keyword is whitelisted for any type', () => {
    const whitelisted = new Set(Object.values(KEYWORDS).flat())
    for (const keyword of fixture) {
      expect(whitelisted.has(keyword)).toBe(false)
    }
  })
})

describe('createTool handler round-trip', () => {
  test('passes nested arguments to the handler without stringification', async () => {
    let received: unknown
    const tool = makeTool(
      z.object({
        location: z.object({ lat: z.number(), lon: z.number() }),
        tags: z.array(z.string()),
        note: z.string().nullish(),
      }),
      async args => {
        received = args
        return { ok: true }
      },
    )

    await tool.handler({
      location: { lat: 40.7, lon: -74.0 },
      tags: ['a', 'b'],
    } as any)

    expect(received).toEqual({
      location: { lat: 40.7, lon: -74.0 },
      tags: ['a', 'b'],
    })
  })

  test('applies defaults for omitted fields before invoking the handler', async () => {
    let received: unknown
    const tool = makeTool(
      z.object({ units: z.enum(['c', 'f']).default('c') }),
      async args => {
        received = args
        return { ok: true }
      },
    )

    await tool.handler({} as any)

    expect(received).toEqual({ units: 'c' })
  })

  test('returns structured results untouched, including nested values and null', async () => {
    const structured = {
      summary: 'cloudy',
      hourly: [
        { hour: 1, temp: 20.5 },
        { hour: 2, temp: 21 },
      ],
      alerts: null,
      station: { id: 'KNYC', active: true },
    }
    const tool = makeTool(z.object({}), async () => structured)

    const result = await tool.handler({} as any)

    expect(result).toEqual(structured)
  })

  test('throws ArgumentParsingError when arguments do not match the schema', async () => {
    const tool = makeTool(z.object({ city: z.string() }))

    expect(tool.handler({ city: 42 } as any)).rejects.toBeInstanceOf(ArgumentParsingError)
  })
})
