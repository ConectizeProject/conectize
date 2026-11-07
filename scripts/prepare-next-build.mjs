/**
 * `next dev` reescreve next-env.d.ts para .next/dev/types (arquivo que
 * corrompe no Windows e não existe no CI). O typecheck do `next build`
 * precisa do caminho de produção.
 *
 * Também corrige o flight manifest quando a build ainda usa o check
 * truthy `if (concatenatedModId)`: `getModuleId()` pode devolver `0` e
 * o client reference some do manifesto (/portal 500).
 * No Next 16.4+ o upstream já usa `!== null` (PR #97936), então o patch
 * vira no-op.
 * https://github.com/vercel/next.js/pull/97936
 */
import { readFileSync, rmSync, writeFileSync } from 'node:fs'

const flightManifestPlugins = [
  'node_modules/next/dist/build/webpack/plugins/flight-manifest-plugin.js',
  'node_modules/next/dist/esm/build/webpack/plugins/flight-manifest-plugin.js',
]

const concatenatedIdCheck = 'if (concatenatedModId) {'
const concatenatedIdCheckFixed = 'if (concatenatedModId != null) {'
const concatenatedIdCheckUpstream = 'if (concatenatedModId !== null) {'

for (const file of flightManifestPlugins) {
  const source = readFileSync(file, 'utf8')
  if (
    source.includes(concatenatedIdCheckFixed) ||
    source.includes(concatenatedIdCheckUpstream)
  ) {
    continue
  }
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
