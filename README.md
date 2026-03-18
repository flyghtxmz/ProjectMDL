# ProjectMDL

Dashboard + roteador de endpoints do Modal para Cloudflare.

## O que este projeto faz

- hospeda um dashboard no Cloudflare
- mantém uma lista de endpoints do Modal cold start
- permite escolher qual endpoint está ativo
- expõe um proxy em `/modal/*` que encaminha para o endpoint ativo
- expõe cada endpoint configurado em um alias fixo, como `/cmfy_01/`, para abrir a UI do ComfyUI pelo domínio do Cloudflare
- mantém um catálogo central persistente de modelos/downloads recebido dos apps do ComfyUI/Modal

Exemplo:

- dashboard: `https://seu-worker.seudominio.workers.dev/`
- dashboard alternativo: `https://seu-worker.seudominio.workers.dev/dashboard/`
- proxy: `https://seu-worker.seudominio.workers.dev/modal/api/view`
- UI do ComfyUI: `https://seu-worker.seudominio.workers.dev/cmfy_01/`

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

5. Defina tambem o token usado pelo Modal para reportar eventos ao registry:

```bash
npx wrangler secret put MODAL_REGISTRY_TOKEN
```

6. Rode localmente:

```bash
npm run dev
```

7. Faça deploy:

```bash
npm run deploy
```

## Endpoints principais

- `GET /api/config`: lê a configuração atual
- `PUT /api/config`: salva a lista de endpoints
- `POST /api/endpoints/:id/activate`: troca o endpoint ativo
- `GET /api/health`: mostra o endpoint ativo
- `GET /api/catalog`: retorna o catálogo central e metadados
- `PUT /api/catalog`: persiste o estado atual do catálogo salvo pela UI
- `POST /api/catalog/save-active`: consulta o catálogo do endpoint ativo e o persiste no catálogo central
- `POST /api/catalog/import`: recebe catálogo enviado pelo ComfyUI/Modal e faz merge/upsert por `entry_id`
- `POST /api/modal-registry/report`: recebe eventos do Modal e salva o ultimo estado por endpoint
- `ALL /modal/*`: encaminha para o endpoint ativo
- `GET /dashboard/`: abre o dashboard administrativo
- `ALL /cmfy_XX/*`: proxy reverso da UI do ComfyUI para cada endpoint configurado

## Auth

Neste momento o projeto está preparado para funcionar sem autenticação.

- `ENABLE_DASHBOARD_AUTH=true` ativa a proteção das rotas administrativas por `DASHBOARD_ADMIN_TOKEN`
- `ENABLE_REGISTRY_AUTH=true` ativa a proteção do registry por `MODAL_REGISTRY_TOKEN`

Se essas flags não forem definidas, o dashboard e a importação de catálogo funcionam sem token.

## Catalogo do endpoint ativo

Quando o dashboard nao tem edicoes locais pendentes, o botao `Salvar Catalogo` tenta buscar o catalogo direto do endpoint ativo e importar no storage central.

Por padrao, o Worker tenta estes caminhos no endpoint ativo:

- `/comfyui-modal/catalog`
- `/comfyui-modal/catalog.json`
- `/catalog`

Se o endpoint de status devolver `catalog_endpoint`, `catalog_url` ou `catalog_api_endpoint`, esse caminho tem prioridade.

## Observação importante

Este scaffold já serve bem para requests HTTP e respostas binárias, como imagens geradas.

O proxy de UI em `/cmfy_XX/*` já faz rewrite de HTML/CSS e encaminhamento de WebSocket, mas continua sendo um proxy best effort. Se algum componente específico do frontend do ComfyUI usar caminhos absolutos fora dos padrões tratados pelo Worker, pode ser necessário ajustar regras adicionais de rewrite.
