## STORIES · Track AI Backend Tracking Core

### BLOCOS PREPARATÓRIOS
1. **STORY-001 · Schema e migrations críticos**  
   Agente: @arquiteto  
   Objetivo: Entregar schema PostgreSQL completo com migrations, todos os indexes críticos (`clicks`, `identities`, `dedupe_registry`) e definições de entropia para event_id.  
   Depende de: nenhuma  
   Paralelo com: nenhuma  
   Critérios de aceite:
   - [ ] Migrations aplicáveis em PostgreSQL RDS Multi-AZ com tabela clicks, identities, tenants, funnels, dispatch_attempts.
   - [ ] Indexes definidos conforme instruções e validados com `EXPLAIN ANALYZE`.
   - [ ] Documentação entregue (`docs/schema` + `docs/track-ai-architecture.md`).
   Pontos de atenção:
   ⚠ Tabelas sensíveis devem manter email_hash/phone_hash.
   🔴 Sem indexes, matching 3 estágios será lento.
   Definição de pronto:
   - Código revisado
   - Testes passando
   - Validado em staging

2. **STORY-002 · Segredos e API Gateway**  
   Agente: @devops  
   Objetivo: Garantir `.env` de referência + Secrets Manager + API Gateway + WAF com rate limit por tenant_id.  
   Depende de: STORY-001  
   Paralelo com: nenhuma  
   Critérios de aceite:
   - [ ] `.env.example` contém todos os campos listados e `CF_BASE_DOMAIN`/`GTM_*`.
   - [ ] AWS Secrets Manager replicando variáveis críticas.
   - [ ] API Gateway com WAF e rate limiting configurado (limite 100 req/min por tenant).
   - [ ] Health/check endpoints prontos (`/health`, `/ready`).
   Pontos de atenção:
   ⚠ Não commitar `.env`.
   🔴 Rate limit incorreto pode bloquear onboarding de leads.
   Definição de pronto:
   - Código revisado
   - Testes passando
   - Validado em staging

### BLOCO 1 — INGESTION API (Gateway Core)
3. **STORY-003 · Webhook Perfect Pay**  
   Agente: @backend-dev  
   Objetivo: Implementar `POST /api/v1/webhooks/perfectpay/{tenant_id}` com HMAC-SHA256 e validação rígida.  
   Depende de: STORY-002  
   Paralelo com: STORY-004 (KIWIFY) após entrega do core  
   Critérios de aceite:
   - [ ] Signature header validado com secret e body raw.
   - [ ] payload normalizado (order_id, email_hash, phone_hash, amount, currency, status, event_time, product_id).
   - [ ] Resultado gravado em `clicks`/`events` e enfileirado em `ingest-events`.
   Pontos de atenção:
   ⚠ Hash SHA-256 obrigatório antes de persistir email/phone.
   🔴 Copiar secret errado leva 401 e falha total de conversão.
   Definição de pronto: Código revisado, testes passando, validado em staging.

4. **STORY-004 · Webhook Kiwify starter** *(MVP 2º)*  
   Agente: @backend-dev  
   Objetivo: Criar `POST /api/v1/webhooks/kiwify/{tenant_id}` replicando padrão HMAC e ACK.  
   Depende de: STORY-003  
   Paralelo com: nenhuma  
   Critérios de aceite:
   - [ ] HMAC e payload mapeado (reaproveita dedupe/order_id).
   - [ ] Mensagem ACK <200ms e enfileira `ingest-events`.
   Pontos de atenção:
   ⚠ Payload diferente, revisar docs.
   🔴 Sem ACK rápido, Perfect Pay retenta e duplica.
   Definição de pronto: Código revisado, testes passando, validado em staging.

### BLOCO 2 — ORQUESTRADOR DE PROVISIONAMENTO
5. **STORY-005 · Provisionamento Cloudflare + Stape**  
   Agente: @devops  
   Objetivo: Criar CNAME proxied=false, gerar Stape container com polling; armazenar URLs e informar lead.  
   Depende de: STORY-003  
   Paralelo com: STORY-006  
   Critérios de aceite:
   - [ ] Cloudflare cria CNAME `{slug}.track.<CF_BASE_DOMAIN>` proxied=false.
   - [ ] Stape container ativo em ≤10min com polling status.
   - [ ] Container ID/tagging_server_url armazenados.
   Pontos de atenção:
   ⚠ Proxied=true quebra SSL.
   🔴 Timeout de polling gera rollback.
   Definição de pronto: Código revisado, testes passando, validado em staging.

6. **STORY-006 · Provisionamento GTM + banco**  
   Agente: @backend-dev  
   Objetivo: Criar container GTM, importar templates, salvar variáveis (pixelID, token, server URL, domain), preparar snippet.  
   Depende de: STORY-005  
   Paralelo com: STORY-005  
   Critérios de aceite:
   - [ ] GTM container gerado e variáveis populadas com revisão obrigatória.
   - [ ] Template importa tags Pixel + sGTM + CAPI Purchase.
   - [ ] Snippet pronto incluído no registro da sessão.
   Pontos de atenção:
   ⚠ Revisão humana obrigatória antes de publicar.
   🔴 Variable errada compromete dados do lead.
   Definição de pronto: Código revisado, testes passando, validado em staging.

### BLOCO 3 — MATCH ENGINE + DEDUP
7. **STORY-007 · Match engine 3 estágios + dedupe**  
   Agente: @backend-dev  
   Objetivo: Processar filas ingest-events e executar matching determinístico/semi/probabilístico, calcular event_id sha256 e gravar em dedupe_registry.  
   Depende de: STORY-003  
   Paralelo com: STORY-005/006 após ingest estar ativo  
   Critérios de aceite:
   - [ ] Determinístico: match por session_id/email_hash/phone_hash.
   - [ ] Semi: uso de fbc/fbclid com janela 7 dias.
   - [ ] Probabilístico: score calculado e flagged.
   - [ ] event_id criado e constraint única mantida.
   Pontos de atenção:
   ⚠ event_id compartilhado com client-side.
   🔴 Falta de dedupe gera múltiplos dispatch.
   Definição de pronto: Código revisado, testes passando, validado em staging.

### BLOCO 4 — DISPATCH ENGINE (CAPI)
8. **STORY-008 · Dispatch CAPI resiliente**  
   Agente: @backend-dev  
   Objetivo: Worker capi-dispatch envia eventos ao Meta Graph API, aplica retries exponenciais e circuit breaker, registra dispatch_attempts.  
   Depende de: STORY-007  
   Paralelo com: STORY-006  
   Critérios de aceite:
   - [ ] Worker lê `capi-dispatch`, chama Meta `/events`.
   - [ ] Retry 1s,2s,4s,8s,16s; circuit breaker após 10 falhas.
   - [ ] Cada tentativa salva em dispatch_attempts.
   Pontos de atenção:
   ⚠ event_id + dedupe obrigatório.
   🔴 Sem circuit breaker, retries inifinitos saturam Meta.
   Definição de pronto: Código revisado, testes passando, validado em staging.

### BLOCO 5 — SETUP AGENT
9. **STORY-009 · Tools do agent**  
   Agente: @agente-setup  
   Objetivo: Implementar tools `validate_meta_token`, `validate_gateway_webhook`, `probe_landing_url`, `check_pixel_presence`, `send_test_capi_event`, `generate_tracking_snippet`.  
   Depende de: STORY-006  
   Paralelo com: STORY-007/008  
   Critérios de aceite:
   - [ ] Cada tool retorna status/erro claro e sugere ação.
   - [ ] `send_test_capi_event` só permite publicar GTM após sucesso no Events Manager.
   - [ ] `generate_tracking_snippet` produz HTML pronto por plataforma.
   Pontos de atenção:
   ⚠ Mensagens nunca genéricas; sempre acciones concretas.
   🔴 Falha no `validate_gateway` bloqueia setup.
   Definição de pronto: Código revisado, testes passando, validado em staging.

10. **STORY-010 · Agent fallback humano**  
    Agente: @agente-setup  
    Objetivo: Três falhas? Gerar transcript + contexto e acionar humano com dados na mão.  
    Depende de: STORY-009  
    Paralelo com: nenhuma  
    Critérios de aceite:
    - [ ] Transcript salva prompts + function calls.
    - [ ] Regra dispara após 3 falhas consecutivas.
    - [ ] Escala para suporte com resumo pronto.
    Pontos de atenção:
    ⚠ Transcript precisa incluir event_id + tenant_id.
    🔴 Sem fallback, leads ficam travados.
    Definição de pronto: Código revisado, testes passando, validado em staging.

### BLOCO 6 — DASHBOARD
11. **STORY-011 · Dashboard wizard + status realtime**  
    Agente: @frontend-dev  
    Objetivo: Wizard modal com progresso (Supabase Realtime), painel de status (matched/pending/failed), replay de eventos na DLQ e Event Match Quality visual.  
    Depende de: STORY-009  
    Paralelo com: STORY-007/008  
    Critérios de aceite:
    - [ ] Front mostra steps, statuses de sessão e snippet.
    - [ ] Painel expõe tabela de eventos (matched/pending/failed).
    - [ ] Botão de replay dispara worker manual.
    Pontos de atenção:
    ⚠ Supabase Realtime precisa consumir eventos de backend.
    🔴 Dados inconsistentes confundem o time.
    Definição de pronto: Código revisado, testes passando, validado em staging.

12. **STORY-012 · Event Match Quality visual**  
    Agente: @frontend-dev  
    Objetivo: Mostrar Event Match Quality por tenant com cores e thresholds (≥6 verde).  
    Depende de: STORY-011  
    Paralelo com: nenhuma  
    Critérios de aceite:
    - [ ] Visual mostra histórico (últimos 7 dias) e destacas quando ≥6.
    - [ ] Eventos com score <6 levantam alerta no backend.
    Pontos de atenção:
    ⚠ Score calculado no backend (Story 007).
    🔴 Visual sem threshold certo passa fake positives.
    Definição de pronto: Código revisado, testes passando, validado em staging.

### BLOCO 7 — MONITORAMENTO
13. **STORY-013 · Monitoramento CloudWatch + Sentry**  
    Agente: @devops  
    Objetivo: CloudWatch alarmas (DLQ depth, dispatch latency p95, errors) e Sentry nos workers.  
    Depende de: STORY-008  
    Paralelo com: STORY-007/009  
    Critérios de aceite:
    - [ ] Alarme DLQ depth > 5 eventos dispara alerta.
    - [ ] Latência p95 > 500ms dispara alerta.
    - [ ] Sentry conectado a ingestion/match/dispatch.
    Pontos de atenção:
    ⚠ Alarmes não podem generar ruído excessivo.
    🔴 Sem monitoramento, issues escapam para produção.
    Definição de pronto: Código revisado, testes passando, validado em staging.

### QA END-TO-END (APÓS BLOCO 7)
14. **STORY-014 · QA End-to-end**  
    Agente: @qa-tester  
    Objetivo: Validar checklist completo do formulário até o Events Manager (ver checklist no prompt).  
    Depende de: STORY-007/008/011/012/013  
    Paralelo com: nenhuma  
    Critérios de aceite:
    - [ ] Todos os 15 itens do checklist QA validados e documentados.
    - [ ] Qa registra bugs no board e trava deploy se falhas críticas.  
    Pontos de atenção:
    ⚠ Sem QA, fluxo não passa.
    🔴 Falha no Event Match Quality impede liberação.
    Definição de pronto: Código revisado, testes passando, validado em staging.
