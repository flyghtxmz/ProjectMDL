# ProjectMDL

Dashboard + roteador de endpoints do Modal para Cloudflare.

## O que este projeto faz

- hospeda um dashboard no Cloudflare
- mantém uma lista de endpoints do Modal cold start
- permite escolher qual endpoint está ativo
- expõe um proxy em `/modal/*` que encaminha para o endpoint ativo

Exemplo:

- dashboard: `https://seu-worker.seudominio.workers.dev/`
- proxy: `https://seu-worker.seudominio.workers.dev/modal/api/view`

## Estrutura

- `public/`: dashboard estático
- `src/worker.js`: API + proxy do endpoint ativo
- `wrangler.jsonc`: configuração do Worker

## Setup

1. Instale dependências:

```bash
npm install
```

2. Crie o KV no Cloudflare:

```bash
npx wrangler kv namespace create MODAL_ROUTER_KV
npx wrangler kv namespace create MODAL_ROUTER_KV --preview
```

3. Copie os IDs retornados e atualize `wrangler.jsonc`.

4. Defina um token administrativo para o dashboard:

```bash
npx wrangler secret put DASHBOARD_ADMIN_TOKEN
```

5. Rode localmente:

```bash
npm run dev
```

6. Faça deploy:

```bash
npm run deploy
```

## Endpoints principais

- `GET /api/config`: lê a configuração atual
- `PUT /api/config`: salva a lista de endpoints
- `POST /api/endpoints/:id/activate`: troca o endpoint ativo
- `GET /api/health`: mostra o endpoint ativo
- `ALL /modal/*`: encaminha para o endpoint ativo

## Observação importante

Este scaffold já serve bem para requests HTTP e respostas binárias, como imagens geradas.

Se depois você quiser usar a UI inteira do ComfyUI por trás do proxy, talvez seja necessário ajustar especificamente o fluxo de WebSocket.
