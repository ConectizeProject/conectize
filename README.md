# Conectize - Assistência Técnica de Celular e Apple

Site institucional da Conectize, assistência técnica especializada em conserto de celulares e produtos Apple em Belo Horizonte.

## Tecnologias

Este projeto foi construído com:

- **Next.js 15** - Framework React com App Router
- **TypeScript** - Tipagem estática
- **React 18** - Biblioteca UI
- **shadcn/ui** - Componentes UI
- **Tailwind CSS** - Estilização
- **React Query** - Gerenciamento de estado do servidor

## Como executar

### Pré-requisitos

- Node.js 18+ instalado
- npm, yarn ou bun

### Instalação

```bash
# Instalar dependências
npm install

# Executar em modo desenvolvimento
npm run dev

# Build para produção
npm run build

# Executar build de produção
npm start
```

O projeto estará disponível em `http://localhost:3000`

## Estrutura do Projeto

```
conectize/
├── app/                    # App Router do Next.js
│   ├── layout.tsx         # Layout raiz
│   ├── page.tsx           # Página inicial
│   ├── not-found.tsx      # Página 404
│   └── globals.css        # Estilos globais
├── src/
│   ├── components/        # Componentes React
│   ├── providers/          # Providers (QueryClient, etc)
│   └── lib/               # Utilitários
├── public/                # Arquivos estáticos
└── next.config.js         # Configuração do Next.js
```

## Variáveis de ambiente (integrações)

### Portal e autenticação (Supabase)

O login do portal (senha, magic link, Google OAuth e recuperação de senha) usa o Supabase no browser e no servidor. Configure:

| Variável | Descrição |
|----------|-----------|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto (Project URL no painel do Supabase). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Chave anônima (anon public). |
| `NEXT_PUBLIC_SITE_URL` | URL canônica do site **sem barra no final** (ex.: `https://seu-dominio.com` ou `http://localhost:3000`). Usada para montar redirects seguros de OAuth e links por e-mail; em produção deve ser o domínio real do deploy. |

**Supabase (Authentication → URL Configuration):**

- **Site URL:** alinhe com `NEXT_PUBLIC_SITE_URL` (ex.: produção `https://seu-dominio.com`).
- **Redirect URLs:** inclua a callback do app, por exemplo:
  - `http://localhost:3000/portal/auth/callback` (desenvolvimento)
  - `https://seu-dominio.com/portal/auth/callback` (produção)
  - URLs de preview (Vercel), se usar.

Sem essas URLs permitidas, o fluxo OAuth ou o link de e-mail pode falhar ou redirecionar para o lugar errado.

### Bling (OAuth)

Para conectar com o Bling via OAuth 2.0, configure:

- `BLING_CLIENT_ID` - Client ID do aplicativo no [developer.bling.com.br](https://developer.bling.com.br/aplicativos)
- `BLING_CLIENT_SECRET` - Client Secret do aplicativo
- `NEXT_PUBLIC_SITE_URL` - URL base do site (ex: `https://seu-dominio.com` ou `http://localhost:3000`) — mesma variável usada pelo portal/SEO acima

**Importante:** Cadastre a URL de redirecionamento no aplicativo Bling: `{NEXT_PUBLIC_SITE_URL}/api/portal/hub/oauth/bling/callback`

### Renovação automática do token Bling

- Em **cada chamada** à API do Bling, o servidor já renova o access token quando ele está **expirado ou perto de expirar** (margem padrão: 30 minutos; opcional: `BLING_ACCESS_TOKEN_REFRESH_MARGIN_MINUTES`).
- Para ambientes **sem tráfego constante**, configure um **cron** que chama o endpoint abaixo (ex.: agendado na Vercel via `vercel.json` — a cada 4 horas):

  - **URL:** `GET /api/cron/bling-refresh-tokens`
  - **Headers:** `Authorization: Bearer <CRON_SECRET>` **ou** `x-cron-secret: <CRON_SECRET>`
  - **Variáveis:** `CRON_SECRET` (obrigatório), `SUPABASE_SERVICE_ROLE_KEY` (necessário para atualizar `hub_connections` sem sessão de usuário), além de `BLING_CLIENT_ID` / `BLING_CLIENT_SECRET`.

Se o Bling responder `invalid_grant` ao renovar, o **refresh token** expirou ou foi revogado — é preciso **desconectar e autorizar de novo** no HUB.

### Mercado Livre (OAuth)

Para conectar com o Mercado Livre via OAuth 2.0 (Authorization Code + Refresh Token), configure:

- `MELI_CLIENT_ID` - App ID no [developers.mercadolivre.com.br](https://developers.mercadolivre.com.br)
- `MELI_CLIENT_SECRET` - Secret Key do aplicativo
- `MELI_REDIRECT_URI` (opcional) - se omitido, usa `{origem}/api/portal/hub/oauth/mercado-livre/callback`

**Importante:** no aplicativo ML, cadastre **exatamente** estas URLs (host canônico de produção):

- Redirect URI: `https://www.conectize.com.br/api/portal/hub/oauth/mercado-livre/callback`
- Notificações: `https://www.conectize.com.br/api/portal/mercado-livre/webhook`

O access token vale ~6 horas. O **refresh token é de uso único** (~6 meses): cada renovação persiste o novo valor em `hub_connections`.

### Renovação automática do token Mercado Livre

- Em **cada chamada** à API, o servidor renova o access token quando está **expirado ou perto de expirar** (margem padrão: 30 minutos; opcional: `MELI_ACCESS_TOKEN_REFRESH_MARGIN_MINUTES`).
- Cron na Vercel (`vercel.json`): **1× por dia** (`0 6 * * *`) — limite do plano Hobby. O access token do ML vale ~6h, então use também o workflow GitHub Actions [`.github/workflows/meli-token-refresh.yml`](.github/workflows/meli-token-refresh.yml) (a cada hora) com secrets `MELI_CRON_URL` e `CRON_SECRET`.

  - **URL:** `GET /api/cron/meli-refresh-tokens`
  - **Headers:** `Authorization: Bearer <CRON_SECRET>` **ou** `x-cron-secret: <CRON_SECRET>`
  - **Variáveis:** `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `MELI_CLIENT_ID` / `MELI_CLIENT_SECRET`.

Se o Mercado Livre responder `invalid_grant` ao renovar, desconecte e autorize de novo no HUB. Pedidos entram pelo webhook `orders_v2` e viram `sales_orders` em `/portal/vendas`.

## Deploy

Este projeto pode ser deployado em:

- **Vercel** (recomendado para Next.js)
- **Netlify**
- **AWS Amplify**
- Qualquer plataforma que suporte Next.js

Para deploy na Vercel:

```bash
npm install -g vercel
vercel
```
