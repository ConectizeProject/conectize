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

Para conectar com o Bling via OAuth 2.0, configure:

- `BLING_CLIENT_ID` - Client ID do aplicativo no [developer.bling.com.br](https://developer.bling.com.br/aplicativos)
- `BLING_CLIENT_SECRET` - Client Secret do aplicativo
- `NEXT_PUBLIC_SITE_URL` - URL base do site (ex: `https://seu-dominio.com` ou `http://localhost:3000`)

**Importante:** Cadastre a URL de redirecionamento no aplicativo Bling: `{NEXT_PUBLIC_SITE_URL}/api/portal/hub/oauth/bling/callback`

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
