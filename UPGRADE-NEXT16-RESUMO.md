# Resumo da Atualização para Next.js 16

## Mudanças Realizadas

### 1. **package.json** – Dependências

| Pacote | Antes | Depois |
|--------|-------|--------|
| next | 15.1.3 | 16.1.0 |
| react | 18.3.1 | 19.0.0 |
| react-dom | 18.3.1 | 19.0.0 |
| eslint-config-next | 15.1.3 | 16.1.0 |
| @types/react | 18.3.23 | 19.0.0 |
| @types/react-dom | 18.3.7 | 19.0.0 |

**Motivo:** Next.js 16 usa React 19, com melhorias de performance e novas APIs.

---

### 2. **middleware.ts → proxy.ts**

- **Arquivo removido:** `middleware.ts` (raiz) e `src/middleware.ts`
- **Arquivo criado:** `proxy.ts` (raiz)
- **Função renomeada:** `middleware()` → `proxy()`

**Motivo:** Em Next.js 16, o nome "middleware" foi substituído por "proxy" para deixar claro que o código roda no limite de rede (interceptação de requests), evitando confusão com middleware estilo Express e encorajando uso apenas para redirects, headers e reescritas.

**Observação:** O proxy passa a rodar em Node.js em vez de Edge; a lógica de auth com Supabase segue funcionando.

---

### 3. **next.config.js**

- **Removido:** `images.domains` (obsoleto no Next.js 16)
- **Removido:** `eslint.ignoreDuringBuilds` (config de ESLint não é mais suportada em next.config)
- **Adicionado:** `experimental.turbopackFileSystemCacheForDev: true`

**Motivo:**
- `images.domains` foi substituído por `remotePatterns`; como estava vazio, foi removido.
- O Turbopack faz cache em disco em dev para builds mais rápidos entre reinícios.

---

### 4. **Turbopack**

O Turbopack agora é o bundler padrão em dev e build. Não é mais necessário `--turbopack` nos scripts; `next dev` e `next build` já o utilizam.

---

## Novas Capacidades do Next.js 16

1. **Turbopack estável** – dev e build mais rápidos
2. **React 19** – View Transitions, Activity, `useEffectEvent`
3. **Runtime Node.js no proxy** – acesso às APIs do Node.js
4. **Cache em disco para dev** – builds mais rápidos após reinício

---

## Próximos passos opcionais

- **React Compiler:** `reactCompiler: true` em `next.config.js` para memoização automática (pode aumentar o tempo de build)
- **Cache Components:** `cacheComponents: true` para usar o modelo de cache com `"use cache"`
- **`updateTag` / `revalidateTag`:** novas APIs de cache para invalidação mais flexível

---

## Comandos para rodar

```bash
npm install   # Se ainda não rodou
npm run dev   # Desenvolvimento
npm run build # Build de produção
```
