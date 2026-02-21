## Track AI Backend Tracking Epic

### Objetivo
Viabilizar o motor de tracking do Track AI para que, ao receber os dados mínimos do lead (pixel, token, landing, gateway), o backend consiga:
- validar credenciais e conectividade
- gerar e versionar GTM containers/templates personalizados
- configurar webhooks (ex: Perfect Pay) e enviar eventos de teste para o Meta CAPI
- monitorar o status de cada etapa e alimentar o dashboard/agent chat com o resultado

### Valor para o cliente
- Setup sem papelada: o lead informa poucos dados, não precisa montar tags manualmente.
- Resposta imediata: o agente identifica falhas, revalida e reexecuta automaticamente.
- Observabilidade interna: logs e métricas ficam dentro do Track AI (não depende de notebooks externos).

### Escopo
1. **Sessões de setup:** APIs para criar, validar e monitorar a jornada (`/api/v1/setup/sessions`, `/status`, `/validate`).
2. **Motor de templates:** serviço que aplica variáveis do lead em templates GTM + Pixel + webhook, armazenando versões e trechos JS para entrega.
3. **Orquestração de integrações:** módulos para validar Meta CAPI (pixel + token) e Perfect Pay webhook, emitir eventos de teste e capturar respostas do Events Manager.
4. **Agente de troubleshooting:** mecanismos para detectar obstáculos (ex: 401 no webhook, token inválido) e responder com instruções guiadas + reexecução de validações.
5. **Observabilidade:** telemetria de cada etapa, interface para revisar logs/alertas e regenerar o snippet sempre que necessário.

### Critérios de aceitação
- É possível criar uma sessão de setup e receber um status `validando`.
- O motor de templates gera um snippet completo com `pixelID`, `access token`, `webhook endpoint` e informações do gateway do lead.
- Um evento de teste chega ao Meta (simulado via Perfect Pay) e o status retorna `evento recebido`.
- Quando algo falha, o agente registra o erro e sugere ações (token, landing, webhook) sem intervenção manual externa.
- Logs e histórico ficam expostos para o dashboard interno do Track AI e podem ser consultados via API.

### Dependências
- Conta GTM corporativa (para publicar containers isolados) ou fallback de snippet pronto.
- Accessos às APIs externas (Meta, Perfect Pay). Do lado do lead, é suficiente fornecer pixel, token, gateway webhook e landing.
- Miro board/ClickUp backlog alinhado com o novo epic (ver `docs/track-ai-architecture.md`).

### Observações
- Efetuei limpeza conceitual: as tarefas antigas foram removidas do roadmap principal para evitar duplicidade com este epic; as novas stories/tarefas abaixo substituem qualquer backlog obsoleto.

— Morgan, planejando o futuro 📊
