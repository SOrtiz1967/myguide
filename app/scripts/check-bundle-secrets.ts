// Falla si el bundle del frontend o el repositorio contienen secretos (Principio I, escenario 17).
// Uso: npm run check:secrets   (compila antes si no existe dist/)
import { execSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { findSecrets, type Finding, type KnownSecret } from './secret-scan.ts'

const appDir = process.cwd()
const repoRoot = join(appDir, '..')

/** Secretos reales del servidor (supabase/.env, que no se sube a Git), si existe. */
function knownSecrets(): KnownSecret[] {
  const envFile = join(repoRoot, 'supabase', '.env')
  if (!existsSync(envFile)) return []
  const secretNames = /(PASSWORD|SECRET|SERVICE_ROLE|API_KEY|TOKEN)/i
  return readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line))
    .filter((m): m is RegExpExecArray => m !== null && secretNames.test(m[1] ?? ''))
    .map((m) => ({ name: m[1] ?? '', value: (m[2] ?? '').trim() }))
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? filesUnder(path) : [path]
  })
}

const BINARY = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|zip|lock)$/i
const isText = (path: string) => !BINARY.test(path) && !path.endsWith('package-lock.json')

function scan(paths: string[], known: KnownSecret[]): Array<Finding & { file: string }> {
  return paths.filter(isText).flatMap((path) =>
    findSecrets(readFileSync(path, 'utf8'), known).map((f) => ({
      ...f,
      file: relative(repoRoot, path).replaceAll('\\', '/'),
    })),
  )
}

const known = knownSecrets()
const dist = join(appDir, 'dist')
if (!existsSync(dist)) {
  console.log('No hay dist/: compilando para revisar el bundle...')
  execSync('npm run build', { stdio: 'inherit' })
}

const tracked = execSync('git ls-files', { cwd: repoRoot, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)
  .map((file) => join(repoRoot, file))
  .filter(existsSync)

const findings = [...scan(filesUnder(dist), known), ...scan(tracked, known)]

console.log(`Revisados: bundle (${filesUnder(dist).length} archivos) y repositorio (${tracked.length} archivos).`)
console.log(`Valores secretos conocidos del servidor usados en la búsqueda: ${known.length}.`)

if (findings.length > 0) {
  console.error('\nSE ENCONTRARON POSIBLES SECRETOS (no se muestran sus valores):')
  for (const f of findings) console.error(`  - ${f.file}:${f.line}  ${f.rule}`)
  process.exit(1)
}
console.log('Sin secretos en el bundle ni en el repositorio.')
