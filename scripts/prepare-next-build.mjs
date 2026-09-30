/**
 * `next dev` reescreve next-env.d.ts para .next/dev/types (arquivo que
 * corrompe no Windows e não existe no CI). O typecheck do `next build`
 * precisa do caminho de produção.
 *
 * Também corrige o flight manifest do Next 16.2: `getModuleId()` pode
 * devolver `0` para um ConcatenatedModule, e `if (concatenatedModId)`
 * descarta esse id. O client reference (ex.: PortalShell) some do
 * manifesto e o /portal responde 500 em produção.
 * https://github.com/vercel/next.js/pull/97936
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs'

const flightManifestPlugins = [
  'node_modules/next/dist/build/webpack/plugins/flight-manifest-plugin.js',
  'node_modules/next/dist/esm/build/webpack/plugins/flight-manifest-plugin.js',
]

const concatenatedIdCheck = 'if (concatenatedModId) {'
const concatenatedIdCheckFixed = 'if (concatenatedModId != null) {'

for (const file of flightManifestPlugins) {
  const source = readFileSync(file, 'utf8')
  if (source.includes(concatenatedIdCheckFixed)) continue
  if (!source.includes(concatenatedIdCheck)) {
    throw new Error(
      `Não achei o check de concatenatedModId em ${file}. O patch do client manifest não pode ser aplicado.`,
    )
  }
  writeFileSync(file, source.replaceAll(concatenatedIdCheck, concatenatedIdCheckFixed))
}

rmSync('.next/dev/types', { recursive: true, force: true })

writeFileSync(
  'next-env.d.ts',
  `/// <reference types="next" />
/// <reference types="next/image-types/global" />
import "./.next/types/routes.d.ts";

// NOTE: This file should not be edited
// see https://nextjs.org/docs/app/api-reference/config/typescript for more information.
`,
)
