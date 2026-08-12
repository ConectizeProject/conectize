# Evolution API no Oracle Cloud (Always Free)

Guia para rodar a Evolution do Conectize em uma VM **gratuita** (Oracle Always Free ARM) e expor com **HTTPS** via Cloudflare Tunnel — sem abrir a porta 8080 na internet e sem pagar hospedagem.

**Stack na VM:** Docker + Evolution + Redis + Postgres local (mesmos arquivos desta pasta).

**Tempo estimado:** 1–2 h (conta Oracle + criar VM pode demorar se a região estiver sem capacidade).

---

## Visão geral

```
GitHub Action (cron)
       ↓
Vercel (conectize.com.br)
       ↓ HTTPS
Cloudflare Tunnel (grátis)
       ↓
Oracle VM (Always Free, ARM)
       ↓
Docker: Evolution :8080 + Redis + Postgres
       ↓ webhook
Vercel /api/webhooks/whatsapp-evolution
```

---

## Parte 1 — Conta Oracle (sem cobrança)

1. Acesse [https://www.oracle.com/cloud/free/](https://www.oracle.com/cloud/free/) e crie a conta.
2. Use cartão só para verificação — **não crie recursos pagos**.
3. Escolha **Home Region** próxima (ex.: **Brazil East (Sao Paulo)** ou **Brazil Southeast (Vinhedo)**).
4. Após criar a conta, em **Billing → Cost Analysis**, crie um **budget alert** com limite **US$ 1** (e-mail se passar de zero).
5. (Recomendado) Ative **Pay As You Go** — continua **$0** dentro do Always Free e facilita criar VM ARM quando há fila de capacidade. **Não** crie shapes pagas (AMD E2 micro extra pago, block volume acima de 200 GB total, etc.).

### Limites Always Free (ARM)

| Recurso | Limite |
|---------|--------|
| CPU/RAM | até **4 OCPUs + 24 GB RAM** no total |
| Disco | **200 GB** block storage (total) |
| Tráfego | ~10 TB/mês saída |

Para Evolution, use **1 VM com 2 OCPUs + 12 GB RAM** (sobra RAM; mais fácil conseguir capacidade que 4/24 de uma vez).

---

## Parte 2 — Criar a VM (Ampere ARM)

1. Console OCI → **Compute → Instances → Create instance**.
2. **Name:** `conectize-evolution`
3. **Image:** Ubuntu 22.04 **Minimal** (aarch64).
4. **Shape:** **Ampere** → `VM.Standard.A1.Flex`
   - OCPUs: **2**
   - Memory: **12 GB**
5. **Boot volume:** **50 GB** (mínimo Always Free por instância).
6. **Networking:** deixe a VCN padrão; marque **Assign a public IPv4 address**.
7. **SSH keys:** gere ou cole sua chave pública (`ssh-keygen -t ed25519` no Windows/Git Bash).
8. **Create**.

### Se der "Out of host capacity"

- Tente outra região Always Free (Ashburn, Phoenix, etc.) **só se aceitar mudar home region na criação da conta**, ou
- Crie com **1 OCPU / 6 GB** e depois edite o shape, ou
- Tente de novo em horários diferentes / use script Terraform em loop (comunidade Oracle).

### Security List (firewall Oracle)

**Networking → Virtual cloud networks → sua VCN → Security Lists → Default**

| Direção | Porta | Origem | Motivo |
|---------|-------|--------|--------|
| Ingress | **22** | Seu IP / `0.0.0.0/0`* | SSH |
| Egress | All | `0.0.0.0/0` | Updates, Cloudflare, WhatsApp |

\* Restringir SSH ao seu IP é mais seguro.

**Não** abra a porta **8080** — o Cloudflare Tunnel acessa localhost.

---

## Parte 3 — Conectar na VM e instalar Docker

No PowerShell (troque `IP` e usuário `ubuntu`):

```powershell
ssh ubuntu@IP_PUBLICO_DA_VM
```

Na VM:

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y git curl ca-certificates

# Docker oficial (ARM64)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker

docker --version
docker compose version
```

---

## Parte 4 — Subir Evolution (Postgres local)

### 4.1 Copiar arquivos para a VM

**Opção A — Git (se o repo for público ou você tiver deploy key):**

```bash
git clone https://github.com/SEU_USUARIO/conectize.git
cd conectize/infra/evolution-api
```

**Opção B — SCP do seu PC (Windows):**

```powershell
scp -r c:\dev\conectize\infra\evolution-api ubuntu@IP_PUBLICO:~/evolution-api
```

Na VM: `cd ~/evolution-api`

### 4.2 Criar `.env`

```bash
cp env.example.txt .env
nano .env
```

Ajuste **no mínimo**:

```env
# Postgres local (docker-compose.postgres.yml)
DATABASE_ENABLED=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:evolution@postgres-evolution:5432/evolution?schema=evolution_api

CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis-evolution:6379/6
CACHE_REDIS_PREFIX_KEY=conectize_evolution

SERVER_URL=https://evolution.SEU_DOMINIO.com.br
SERVER_PORT=8080

# Gere: openssl rand -hex 32
AUTHENTICATION_API_KEY=SUA_CHAVE_LONGA_AQUI

# Menos gravações = mais rápido (Conectize guarda mensagens no Supabase do app)
DATABASE_SAVE_DATA_NEW_MESSAGE=false
DATABASE_SAVE_MESSAGE_UPDATE=false
DATABASE_SAVE_DATA_CONTACTS=false
DATABASE_SAVE_DATA_CHATS=false
DATABASE_SAVE_DATA_LABELS=false
DATABASE_SAVE_DATA_HISTORIC=false
```

Guarde `AUTHENTICATION_API_KEY` — é a mesma que vai na Vercel como `WHATSAPP_EVOLUTION_API_KEY`.

### 4.3 Subir containers

```bash
docker compose -f docker-compose.yml -f docker-compose.postgres.yml --env-file .env up -d
docker compose ps
curl -s http://127.0.0.1:8080/ | head
```

Aguarde ~30s na primeira subida (migrações Prisma).

---

## Parte 5 — Cloudflare Tunnel (HTTPS grátis)

Requisito: domínio no Cloudflare (ex.: `conectize.com.br`).

### 5.1 Instalar cloudflared na VM

```bash
curl -L https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb -o cloudflared.deb
sudo dpkg -i cloudflared.deb
cloudflared --version
```

### 5.2 Login e tunnel

```bash
cloudflared tunnel login
cloudflared tunnel create conectize-evolution
```

Anote o **Tunnel ID** e crie `~/.cloudflared/config.yml`:

```yaml
tunnel: SEU_TUNNEL_ID
credentials-file: /home/ubuntu/.cloudflared/SEU_TUNNEL_ID.json

ingress:
  - hostname: evolution.conectize.com.br
    service: http://127.0.0.1:8080
  - service: http_status:404
```

### 5.3 DNS no Cloudflare

Dashboard → **DNS → CNAME**:

| Tipo | Nome | Conteúdo |
|------|------|----------|
| CNAME | `evolution` | `SEU_TUNNEL_ID.cfargotunnel.com` |

Proxy: **Proxied** (laranja).

### 5.4 Serviço systemd

```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
sudo systemctl status cloudflared
```

Teste do seu PC:

```powershell
curl.exe -s https://evolution.conectize.com.br/
```

---

## Parte 6 — Instância WhatsApp + webhook

1. Abra `https://evolution.conectize.com.br/manager`
2. API Key = `AUTHENTICATION_API_KEY` do `.env`
3. Crie a instância (ex.: `Conectize`) e escaneie o QR no celular.
4. **Grupos:** `groupsIgnore` deve ser **false** (script `enable-group-messages.ps1` no PC apontando `-BaseUrl https://evolution...`).

Webhook para produção:

```bash
curl -s -X POST "https://evolution.conectize.com.br/webhook/set/NOME_INSTANCIA" \
  -H "apikey: SUA_AUTHENTICATION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "enabled": true,
      "url": "https://www.conectize.com.br/api/webhooks/whatsapp-evolution",
      "webhookByEvents": false,
      "webhookBase64": false,
      "events": ["MESSAGES_UPSERT", "MESSAGES_UPDATE", "SEND_MESSAGE"]
    }
  }'
```

Se usar `WHATSAPP_EVOLUTION_WEBHOOK_SECRET` na Vercel, configure o mesmo header na Evolution (Hub ou webhook global).

---

## Parte 7 — Vercel + Hub Conectize

**Vercel → Environment Variables (Production):**

| Variável | Valor |
|----------|--------|
| `WHATSAPP_EVOLUTION_API_URL` | `https://evolution.conectize.com.br` |
| `WHATSAPP_EVOLUTION_API_KEY` | = `AUTHENTICATION_API_KEY` |
| `WHATSAPP_EVOLUTION_WEBHOOK_SECRET` | (opcional, igual Hub) |
| `CRON_SECRET` | igual GitHub Actions |

Redeploy na Vercel.

No **Portal → Hub → Evolution:**

- `instance_name` = mesmo da instância (ex.: `Conectize`)
- API key (ou vazio se usa só env)
- **URL base override** = `https://evolution.conectize.com.br` (opcional se env já está certo)

Teste: Hub → enviar mensagem de teste. Depois o cron:

```powershell
curl.exe "https://www.conectize.com.br/api/cron/whatsapp-seminovos-lojistas-broadcast?force=1" `
  -H "Authorization: Bearer SEU_CRON_SECRET"
```

---

## Parte 8 — Manutenção (Always Free)

```bash
# Logs
docker compose -f docker-compose.yml -f docker-compose.postgres.yml logs -f evolution-api

# Reiniciar (evite — pode pedir QR de novo)
docker compose -f docker-compose.yml -f docker-compose.postgres.yml restart evolution-api

# Limpar imagens antigas (disco 50 GB enche)
docker system prune -af --filter "until=168h"
```

Configure **cron na VM** (opcional) para prune semanal:

```bash
(crontab -l 2>/dev/null; echo "0 4 * * 0 docker system prune -af --filter until=168h") | crontab -
```

**Não** desligue a VM por longos períodos — WhatsApp desconecta; Oracle pode reclamar de instância ociosa.

---

## Checklist "não pagar"

- [ ] Shape **A1 Flex** only (Always Free)
- [ ] Boot volume **≤ 50 GB** por instância, **≤ 200 GB** total
- [ ] Budget alert **US$ 1**
- [ ] Não criar Load Balancer / OKE / DB Oracle pagos
- [ ] Não aumentar boot volume além do free sem necessidade

---

## Script automatizado (VM)

Depois do SSH na VM, você pode usar:

```bash
bash scripts/deploy-oracle.sh
```

(Só instala Docker e sobe compose — você ainda precisa criar `.env` e Cloudflare manualmente nas partes 4–5.)

---

## Problemas comuns

| Sintoma | Causa | Solução |
|---------|--------|---------|
| Vercel `fetch failed` | URL localhost ou VM inacessível | `WHATSAPP_EVOLUTION_API_URL` = URL Cloudflare |
| QR toda hora | Volume não persistiu / restart | Confira `docker volume ls` e `evolution_instances` |
| Webhook 401 | Secret diferente | Alinhar `WHATSAPP_EVOLUTION_WEBHOOK_SECRET` |
| Grupo não recebe | `groupsIgnore=true` | POST settings com `groupsIgnore:false` |
| Cron duplicado | Vários testes no mesmo dia | Normal; dedup bloqueia 2º envio (use `?force=1` só em teste) |
