# Hub Server-Side Tracking — Documentação Educativa

Esta pasta contém documentação feita para **explicar como o sistema funciona** — não como um manual técnico, mas como se você nunca tivesse visto código antes.

**Audiência:**
- Desenvolvedores novos no projeto
- Stakeholders técnicos que querem entender o sistema
- Você mesmo daqui a 6 meses quando esquecer como isso funciona

---

## Documentos

### 1. TECHNICAL-DEEP-DIVE.md (Este é o grande!)

**Você quer saber:**
- Onde seu servidor fica fisicamente (AWS, Fargate, etc)
- Quanto custa rodar isso
- Como 14 parâmetros fluem pelo sistema
- Como adicionar um novo parâmetro

**Tamanho:** 3.500 linhas (10 páginas)
**Tempo:** 30 minutos
**Pré-requisito:** Nenhum

**O que cobre:**

| Seção | Tópico | Quando Ler |
|-------|--------|-----------|
| 1 | **Infraestrutura** | Você quer saber onde o servidor fica |
| 1.1 | Arquitetura AWS | Entender componentes (ECS, RDS, Redis, SQS) |
| 1.2 | Significado de cada componente | Explicação em linguagem leiga |
| 1.3 | Por que essa arquitetura? | Comparação com alternativas |
| 1.4 | Alternativas (Heroku, Railway, etc) | Quando migrar |
| 1.5 | Custo de infraestrutura | Números reais de AWS/mês |
| 1.6 | Como acessar seu servidor | URL customizada |
| 1.7 | Escalabilidade | O que acontece com crescimento |
| --- | --- | --- |
| 2 | **CUSTO POR EVENTO** | Você quer saber quanto custa cada evento |
| 2.1 | Como AWS cobra | Não é por usuário, é por consumo |
| 2.2 | Custo real por evento | $0,00885 por evento |
| 2.3 | Seus modelos de precificação | Fixo, Pay-per-use, Hybrid |
| 2.4 | Margem de lucro real | Exemplos com números |
| 2.5 | Qual modelo funciona? | Recomendação |
| --- | --- | --- |
| 3 | **OS 14 PARÂMETROS** | Quais são e onde vão |
| 3.1 | Lista dos 14 | fbclid, fbp, fbc, utm*, ip, url, etc |
| 3.2 | Onde cada um vai no banco | Click table, Pageview table, Conversion table |
| 3.3 | Product ID + Custom Value | Parâmetros 13-14 |
| --- | --- | --- |
| 4 | **FLUXO DE DADOS** | Como 14 parâmetros fluem |
| 4.1 | Fluxo completo passo-a-passo | Click → Banco → Webhook → Matching → Meta |
| 4.2 | Tabela resumida | Onde cada parâmetro aparece |
| --- | --- | --- |
| 5 | **ADICIONAR NOVO PARÂMETRO** | How-to guia |
| 5.1 | Exemplo: "Cupom Usado" | Passo-a-passo real |
| 5.2 | 7 passos | Schema → Migration → Handler → Test |
| 5.3 | Adicionar a webhook também | Extensão do exemplo |
| --- | --- | --- |
| 6 | **CUSTO REAL (Cenários)** | Matemática com números |
| 6.1 | Cenário A: Agência de Marketing | 4 clientes, 85k eventos/dia |
| 6.2 | Cenário B: SaaS E-commerce | 10 lojas, 530k eventos/dia |
| 6.3 | Tabela de Referência | Volume → Custo AWS → Preço |
| 6.4 | Sua Decisão | Como escolher modelo |

**Tópicos principais:**
- ✓ Infraestrutura AWS (ECS, RDS, Redis, SQS)
- ✓ Custo por evento ($0,00885)
- ✓ Os 14 parâmetros (fbclid, fbp, utm_source, ip, url, etc)
- ✓ Onde cada parâmetro é armazenado (Click, Pageview, Conversion tables)
- ✓ Fluxo completo de dados (passo-a-passo com diagrama)
- ✓ Como adicionar novo parâmetro (7 passos)
- ✓ Matemática de custo com cenários reais

---

### 2. CODE-EXAMPLES.md (O segundo!)

**Você quer saber:**
- Como o código realmente funciona
- Ver exemplos REAIS do seu projeto
- Entender Frontend → Backend → Banco → Meta

**Tamanho:** 2.500 linhas (8 páginas)
**Tempo:** 20 minutos
**Pré-requisito:** Nenhum (mas entender TECHNICAL-DEEP-DIVE ajuda)

**O que cobre:**

| Seção | Tópico | Quando Ler |
|-------|--------|-----------|
| 1 | **Frontend JS** | Como pixel envia 14 parâmetros |
| 1.1 | Código HTML/JS real | Extrai fbclid, utm_*, ip, etc da página |
| 1.2 | O que cada parâmetro significa | fbclid = identificador do clique, etc |
| --- | --- | --- |
| 2 | **Backend: Recebendo** | Como servidor recebe |
| 2.1 | Click Handler (click-handler.ts) | Código real com comentários |
| 2.2 | Validação com Zod | Schema que valida 14 parâmetros |
| --- | --- | --- |
| 3 | **Banco de Dados** | Estrutura Prisma |
| 3.1 | Tabela Click | Armazena fbclid, fbp, fbc, utm*, ip, ua |
| 3.2 | Tabela Conversion | Armazena email hashed, phone hashed, amount |
| --- | --- | --- |
| 4 | **Match Engine** | Como conecta clique → conversão |
| 4.1 | Código real (simplificado) | Busca fbc → fbp → email |
| --- | --- | --- |
| 5 | **Webhook Handler** | Como recebe dados do Hotmart |
| 5.1 | Hotmart Webhook (real) | Valida HMAC → hashes PII → armazena |
| --- | --- | --- |
| 6 | **Dispatch para Meta** | Como envia para Meta CAPI |
| 6.1 | Dispatch Engine (real) | Monta payload com hashes + IDs Facebook |
| --- | --- | --- |
| 7 | **Exemplo Completo** | Um clique → uma conversão |
| 7.1 | Timeline de 5 minutos | 10:00 clique → 10:05 compra → 10:06 Meta |
| --- | --- | --- |
| 8 | **Estrutura do Projeto** | Onde cada arquivo fica |
| --- | --- | --- |
| 9 | **Adicionar Novo Parâmetro** | Exemplo prático (lpVersion) |
| --- | --- | --- |

**Tópicos principais:**
- ✓ Frontend JS (como envia 14 parâmetros)
- ✓ Backend handler (click-handler.ts real)
- ✓ Zod validation (schema real)
- ✓ Click table (Prisma model real)
- ✓ Conversion table (Prisma model real)
- ✓ Match Engine (código simplificado)
- ✓ Hotmart webhook (código real com HMAC)
- ✓ Dispatch para Meta CAPI (código real)
- ✓ Timeline de exemplo (clique → conversão → Meta)
- ✓ Estrutura de pastas do projeto
- ✓ Exemplo prático: adicionar "lpVersion"

---

## Como Usar Esta Documentação

### Cenário 1: Você é novo no projeto

1. **Leia:** `TECHNICAL-DEEP-DIVE.md` (seção 1 e 4)
   - Entender infraestrutura (onde fica o servidor)
   - Entender fluxo de dados (14 parâmetros)
   - Tempo: 15 minutos

2. **Leia:** `CODE-EXAMPLES.md` (seção 1-6)
   - Ver como o código realmente funciona
   - Tempo: 15 minutos

3. **Pronto!** Você entende como o sistema funciona.

### Cenário 2: Você quer adicionar um parâmetro novo

1. **Leia:** `TECHNICAL-DEEP-DIVE.md` (seção 5)
   - Passo-a-passo para adicionar novo parâmetro
   - Tempo: 5 minutos

2. **Abra seu editor** e siga os 7 passos
   - Prisma schema → migration → handler → test
   - Tempo: 10 minutos

3. **Pronto!** Novo parâmetro está rodando.

### Cenário 3: Você quer entender custos

1. **Leia:** `TECHNICAL-DEEP-DIVE.md` (seção 2 e 6)
   - Custo por evento ($0,00885)
   - Modelos de precificação (fixo, pay-per-use, hybrid)
   - Exemplos com números reais
   - Tempo: 15 minutos

2. **Ajuste sua precificação** baseado no cenário mais próximo
   - Tempo: 5 minutos

3. **Pronto!** Você sabe quanto cobrar.

### Cenário 4: Você precisa explicar para alguém

1. **Se é CEO/investidor:** Compartilhe seção 2 (custo) e 1.5 (infraestrutura)
2. **Se é dev novo:** Compartilhe seção 1, 4, 5
3. **Se é cliente:** Compartilhe versão simplificada de seção 4 (fluxo)

---

## Estrutura de Aprendizado

```
Nível 1 (Iniciante)
├─ O que é Hub Server-Side Tracking? (README.md)
├─ Infraestrutura (DEEP-DIVE.md seção 1)
└─ Os 14 parâmetros (DEEP-DIVE.md seção 3)

Nível 2 (Intermediário)
├─ Fluxo de dados (DEEP-DIVE.md seção 4)
├─ Código real (CODE-EXAMPLES.md seções 1-6)
└─ Como adicionar parâmetro (DEEP-DIVE.md seção 5)

Nível 3 (Avançado)
├─ Custo e precificação (DEEP-DIVE.md seções 2 e 6)
├─ Match engine (CODE-EXAMPLES.md seção 4)
└─ Dispatch para Meta CAPI (CODE-EXAMPLES.md seção 6)

Nível 4 (Especialista)
├─ Leia código real em apps/api/src/
├─ Leia migrations em apps/api/prisma/
└─ Execute testes (npm run test)
```

---

## Glossário

**Já sabe inglês técnico?** Aqui está um glossário rápido:

| Termo | Tradução | Significado |
|-------|----------|-----------|
| **ECS Fargate** | Elastic Container Service | Serviço AWS que roda containers |
| **RDS** | Relational Database Service | PostgreSQL gerenciado pela AWS |
| **Redis** | (sigla: Re-Database In-Memory) | Memória ultrarrápida para cache |
| **SQS** | Simple Queue Service | Fila de trabalhos da AWS |
| **fbclid** | Facebook Click ID | ID único do clique |
| **fbp** | Facebook Pixel ID | ID do visitor |
| **fbc** | Facebook Container ID | ID do browser container |
| **UTM** | Urchin Tracking Module | Parâmetros de campanha |
| **CAPI** | Conversions API | API server-side do Meta |
| **HMAC** | Hash-based Message Authentication Code | Assinatura criptográfica |
| **SHA-256** | Secure Hash Algorithm 256-bit | Hashing (irreversível) |
| **Webhook** | Web hook / Callback | URL que serviço externo chama |
| **Matching** | (sem tradução comum) | Conectar clique com conversão |
| **Dedup** | Deduplication | Evitar registros duplicados |

---

## Referências Externas

### Quando você precisa de informações extras:

**AWS:**
- [AWS ECS Fargate Pricing](https://aws.amazon.com/ecs/pricing/)
- [AWS RDS PostgreSQL](https://aws.amazon.com/rds/postgresql/)
- [AWS SQS Pricing](https://aws.amazon.com/sqs/pricing/)

**Meta (Facebook):**
- [Meta Conversions API (CAPI) Docs](https://developers.facebook.com/docs/marketing-api/conversions-api)
- [Facebook Pixel Guide](https://developers.facebook.com/docs/facebook-pixel)

**Tecnologias:**
- [Prisma ORM](https://www.prisma.io/docs/)
- [Zod Validation](https://zod.dev/)
- [Fastify Framework](https://www.fastify.io/docs/)
- [TypeScript](https://www.typescriptlang.org/docs/)

**Segurança:**
- [LGPD - Lei de Proteção de Dados](https://www.gov.br/cidadania/pt-br/acesso-a-informacao/lgpd)
- [GDPR - Regulamento de Proteção de Dados (EU)](https://gdpr-info.eu/)
- [SHA-256 Hash Function](https://en.wikipedia.org/wiki/SHA-2)

---

## FAQ

**P: Quanto tempo leva para aprender tudo?**
R: Iniciante: 30 minutos | Intermediário: 1 hora | Avançado: 2-3 horas

**P: Preciso saber programar para ler isso?**
R: Não! A documentação explica conceitos em linguagem leiga. Mas se sabe programar, CODE-EXAMPLES.md terá mais sentido.

**P: Posso compartilhar com stakeholders?**
R: Sim! Compartilhe TECHNICAL-DEEP-DIVE.md seção 1 (infraestrutura) e seção 6 (custo).

**P: Preciso de mais detalhe em algum tópico?**
R: Sim! Leia o arquivo correspondente completo, depois leia código real em `apps/api/src/`.

**P: Como manter essa documentação atualizada?**
R: Sempre que adicionar novo parâmetro ou mudar arquitetura, atualize:
1. `TECHNICAL-DEEP-DIVE.md` seção 3 (parâmetros)
2. `CODE-EXAMPLES.md` seção 9 (exemplo de adicionar)
3. `TECHNICAL-DEEP-DIVE.md` seção 1 (se infraestrutura mudar)

---

## Próximos Passos

1. **Leia `TECHNICAL-DEEP-DIVE.md` seção 1**
   - Entender onde o servidor fica (AWS)
   - Tempo: 10 minutos

2. **Leia `CODE-EXAMPLES.md` seção 1-6**
   - Ver código real funcionando
   - Tempo: 15 minutos

3. **Execute um teste**
   ```bash
   npm run test  # Rode testes para ver código em ação
   ```

4. **Adicione um parâmetro novo**
   - Siga o guia em `TECHNICAL-DEEP-DIVE.md` seção 5
   - Consolidar aprendizado fazendo algo prático

5. **Explore o código**
   - Abra `apps/api/src/click-handler.ts`
   - Abra `apps/api/src/match-engine.ts`
   - Abra `apps/api/prisma/schema.prisma`

---

## Feedback & Melhorias

Se você:
- Não entendeu algo → Abra issue explicando
- Encontrou erro → Corrija no doc
- Quer mais detalhes → Peça em issue

Documentação vive e evolui com o projeto.

---

**Última atualização:** 2 de março de 2026
**Versão:** 1.0
**Autor:** Claude Code + Você
**Licença:** MIT (compartilhe à vontade)

---

**Comece lendo:** [TECHNICAL-DEEP-DIVE.md](TECHNICAL-DEEP-DIVE.md)
