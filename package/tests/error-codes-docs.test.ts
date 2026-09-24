import { expect, test } from 'bun:test'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const packageRoot = join(import.meta.dir, '..')
const repoRoot = join(packageRoot, '..')

function sources(directory: string, extension: string): string[] {
  return readdirSync(directory, { recursive: true, encoding: 'utf8' })
    .filter(file => file.endsWith(extension))
    .map(file => readFileSync(join(directory, file), 'utf8'))
}

function matches(texts: string[], pattern: RegExp): string[] {
  return texts.flatMap(text => [...text.matchAll(pattern)].map(match => match[1] ?? ''))
}

const code = '([A-Z][A-Z0-9_]*)'

function emittedCodes(): string[] {
  const swift = sources(join(packageRoot, 'ios'), '.swift')
  const typescript = sources(join(packageRoot, 'src'), '.ts')
  const codes = [
    ...matches(swift, new RegExp(`return "${code}"`, 'g')),
    ...matches(swift, new RegExp(`case \\w+ = "${code}"`, 'g')),
    ...matches(typescript, new RegExp(`(?:new AppleAIError|super)\\(\\s*'${code}'`, 'g')),
    ...matches(typescript, new RegExp(`fallbackCode: '${code}'`, 'g')),
    ...matches(typescript, new RegExp(`\\?\\? '${code}'`, 'g')),
  ]
  return [...new Set(codes)].sort()
}

function documentedCodes(): string[] {
  const reference = readFileSync(join(repoRoot, 'docs/docs/api-reference.md'), 'utf8')
  const table = reference.split('#### Error Codes')[1]?.split('\n\n')[1] ?? ''
  return matches([table], new RegExp(`^\\| \`${code}\` \\|`, 'gm')).sort()
}

test('the API reference error table lists exactly the codes the library emits', () => {
  expect(emittedCodes().length).toBeGreaterThan(30)
  expect(documentedCodes()).toEqual(emittedCodes())
})

test('the repository README and the package README are the same quickstart', () => {
  expect(readFileSync(join(repoRoot, 'README.md'), 'utf8')).toBe(
    readFileSync(join(packageRoot, 'README.md'), 'utf8'),
  )
})
