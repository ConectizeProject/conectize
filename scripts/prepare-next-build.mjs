/**
 * `next dev` reescreve next-env.d.ts para .next/dev/types (arquivo que
 * corrompe no Windows e não existe no CI). O typecheck do `next build`
 * precisa do caminho de produção.
 */
import { rmSync, writeFileSync } from 'node:fs'

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
