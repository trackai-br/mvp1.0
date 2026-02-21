# Synkra AIOS Development Rules for Claude Code

You are working with Synkra AIOS, an AI-Orchestrated System for Full Stack Development.

<!-- AIOS-MANAGED-START: core-framework -->
## Core Framework Understanding

Synkra AIOS is a meta-framework that orchestrates AI agents to handle complex development workflows. Always recognize and work within this architecture.
<!-- AIOS-MANAGED-END: core-framework -->

<!-- AIOS-MANAGED-START: agent-system -->
## Agent System

### Agent Activation
- Agents are activated with @agent-name syntax: @dev, @qa, @architect, @pm, @po, @sm, @analyst
- The master agent is activated with @aios-master
- Agent commands use the * prefix: *help, *create-story, *task, *exit

### Agent Context
When an agent is active:
- Follow that agent's specific persona and expertise
- Use the agent's designated workflow patterns
- Maintain the agent's perspective throughout the interaction
<!-- AIOS-MANAGED-END: agent-system -->

## Development Methodology

### Story-Driven Development
1. **Work from stories** - All development starts with a story in `docs/stories/`
2. **Update progress** - Mark checkboxes as tasks complete: [ ] → [x]
3. **Track changes** - Maintain the File List section in the story
4. **Follow criteria** - Implement exactly what the acceptance criteria specify

### Code Standards
- Write clean, self-documenting code
- Follow existing patterns in the codebase
- Include comprehensive error handling
- Add unit tests for all new functionality
- Use TypeScript/JavaScript best practices

### Testing Requirements
- Run all tests before marking tasks complete
- Ensure linting passes: `npm run lint`
- Verify type checking: `npm run typecheck`
- Add tests for new features
- Test edge cases and error scenarios

<!-- AIOS-MANAGED-START: framework-structure -->
## AIOS Framework Structure

```
aios-core/
├── agents/         # Agent persona definitions (YAML/Markdown)
├── tasks/          # Executable task workflows
├── workflows/      # Multi-step workflow definitions
├── templates/      # Document and code templates
├── checklists/     # Validation and review checklists
└── rules/          # Framework rules and patterns

docs/
├── stories/        # Development stories (numbered)
├── prd/            # Product requirement documents
├── architecture/   # System architecture documentation
└── guides/         # User and developer guides
```
<!-- AIOS-MANAGED-END: framework-structure -->

## Workflow Execution

### Task Execution Pattern
1. Read the complete task/workflow definition
2. Understand all elicitation points
3. Execute steps sequentially
4. Handle errors gracefully
5. Provide clear feedback

### Interactive Workflows
- Workflows with `elicit: true` require user input
- Present options clearly
- Validate user responses
- Provide helpful defaults

## Best Practices

### When implementing features:
- Check existing patterns first
- Reuse components and utilities
- Follow naming conventions
- Keep functions focused and testable
- Document complex logic

### When working with agents:
- Respect agent boundaries
- Use appropriate agent for each task
- Follow agent communication patterns
- Maintain agent context

### When handling errors:
```javascript
try {
  // Operation
} catch (error) {
  console.error(`Error in ${operation}:`, error);
  // Provide helpful error message
  throw new Error(`Failed to ${operation}: ${error.message}`);
}
```

## Git & GitHub Integration

### Commit Conventions
- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`, etc.
- Reference story ID: `feat: implement IDE detection [Story 2.1]`
- Keep commits atomic and focused

### GitHub CLI Usage
- Ensure authenticated: `gh auth status`
- Use for PR creation: `gh pr create`
- Check org access: `gh api user/memberships`

<!-- AIOS-MANAGED-START: aios-patterns -->
## AIOS-Specific Patterns

### Working with Templates
```javascript
const template = await loadTemplate('template-name');
const rendered = await renderTemplate(template, context);
```

### Agent Command Handling
```javascript
if (command.startsWith('*')) {
  const agentCommand = command.substring(1);
  await executeAgentCommand(agentCommand, args);
}
```

### Story Updates
```javascript
// Update story progress
const story = await loadStory(storyId);
story.updateTask(taskId, { status: 'completed' });
await story.save();
```
<!-- AIOS-MANAGED-END: aios-patterns -->

## Environment Setup

### Required Tools
- Node.js 18+
- GitHub CLI
- Git
- Your preferred package manager (npm/yarn/pnpm)

### Configuration Files
- `.aios/config.yaml` - Framework configuration
- `.env` - Environment variables
- `aios.config.js` - Project-specific settings

<!-- AIOS-MANAGED-START: common-commands -->
## Common Commands

### AIOS Master Commands
- `*help` - Show available commands
- `*create-story` - Create new story
- `*task {name}` - Execute specific task
- `*workflow {name}` - Run workflow

### Development Commands
- `npm run dev` - Start development
- `npm test` - Run tests
- `npm run lint` - Check code style
- `npm run build` - Build project
<!-- AIOS-MANAGED-END: common-commands -->

## Debugging

### Enable Debug Mode
```bash
export AIOS_DEBUG=true
```

### View Agent Logs
```bash
tail -f .aios/logs/agent.log
```

### Trace Workflow Execution
```bash
npm run trace -- workflow-name
```

## Claude Code Specific Configuration

### Performance Optimization
- Prefer batched tool calls when possible for better performance
- Use parallel execution for independent operations
- Cache frequently accessed data in memory during sessions

### Tool Usage Guidelines
- Always use the Grep tool for searching, never `grep` or `rg` in bash
- Use the Task tool for complex multi-step operations
- Batch file reads/writes when processing multiple files
- Prefer editing existing files over creating new ones

### Session Management
- Track story progress throughout the session
- Update checkboxes immediately after completing tasks
- Maintain context of the current story being worked on
- Save important state before long-running operations

### Error Recovery
- Always provide recovery suggestions for failures
- Include error context in messages to user
- Suggest rollback procedures when appropriate
- Document any manual fixes required

### Testing Strategy
- Run tests incrementally during development
- Always verify lint and typecheck before marking complete
- Test edge cases for each new feature
- Document test scenarios in story files

### Documentation
- Update relevant docs when changing functionality
- Include code examples in documentation
- Keep README synchronized with actual behavior
- Document breaking changes prominently

---
*Synkra AIOS Claude Code Configuration v2.0*

---

<!-- PROJECT-CONTEXT-START: hub-server-side-tracking -->
## Projeto: Hub Server-Side Tracking

SaaS multi-tenant de server-side tracking para Meta Ads. Intermediário entre gateways de pagamento (PerfectPay, Hotmart, Kiwify) e Meta Conversions API (CAPI), com foco em alto match rate e deduplicação robusta.

### Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Node.js 18+, Fastify 5, Prisma 7 + PostgreSQL |
| Frontend | Next.js 16, React 19, TanStack Query, React Hook Form |
| Shared | TypeScript 5.9, Zod 4 (schemas compartilhados via `packages/shared`) |
| Infra | AWS (API Gateway, WAF, ECS Fargate, SQS, SecretsManager, CloudWatch) |
| Database | PostgreSQL via Supabase (prod) |
| Filas | BullMQ + Redis / SQS |
| Testes | Vitest + Supertest |

### Estrutura do Monorepo

```
apps/api/          # Backend Fastify (porta 3001)
  src/
    server.ts                          # Router principal + setup de rotas
    db.ts                              # Instância singleton do Prisma
    click-handler.ts                   # POST /api/v1/track/click
    perfectpay-webhook-handler.ts      # POST /api/v1/webhooks/perfectpay/:tenantId
    setup-store.ts                     # Store em-memória para setup sessions
    validation.ts                      # Validações (parcialmente mockadas)
  prisma/
    schema.prisma                      # 8 modelos: Tenant, Click, Identity, etc.
    migrations/                        # Migrations Prisma

apps/web/          # Frontend Next.js (porta 3000)
  src/app/page.tsx                     # Wizard onboarding 3 passos

packages/shared/   # Schemas Zod compartilhados entre api e web
  src/index.ts                         # setupSessionCreateSchema, clickIngestSchema, etc.

docs/
  stories/                             # Stories de desenvolvimento (story-track-ai-NNN-*.md)
  learning/GUIDE.md                    # Documentação educativa (linguagem leiga)
  README-architecture.md               # Overview técnico completo
  database-schema.md                   # Referência rápida do schema
```

### Comandos

```bash
# Monorepo root
npm install             # Instala todas as dependências (workspaces)
npm run dev             # Inicia api (3001) + web (3000) em paralelo
npm run dev:api         # Apenas backend
npm run dev:web         # Apenas frontend
npm run build           # Build completo
npm run lint            # ESLint em todos os apps
npm run typecheck       # TypeScript --noEmit em todos os apps
npm run test            # Vitest em todos os apps

# Database (executar a partir de apps/api/)
npx prisma migrate dev  # Nova migration em dev
npx prisma generate     # Regenera Prisma Client após mudança no schema
npx prisma studio       # GUI do banco

# Atalhos raiz
npm run prisma:migrate
npm run prisma:generate
```

### Variáveis de Ambiente

Template em `.env.example`. Valores reais em `infra/secrets/.env.local` (gitignored).
Variáveis principais:

```
# Database
DATABASE_URL             # PostgreSQL Supabase connection string

# Meta CAPI
META_GRAPH_API_BASE      # https://graph.facebook.com

# PerfectPay
PERFECTPAY_API_BASE
PERFECTPAY_WEBHOOK_SECRET

# AWS (para deploy)
AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY

# Redis
REDIS_URL
```

### Modelo de Dados (schema.prisma)

Modelos principais:
- **Tenant** — unidade multi-tenant (slug único, status: provisioning/active/suspended/retired)
- **Click** — cliques de ads (fbclid, fbc, fbp, UTMs, IP, userAgent) indexados por `(tenantId, fbc)` e `(tenantId, fbclid)`
- **Identity** — hashes de email/phone para matching determinístico, indexados por tenant
- **DedupeRegistry** — controle de duplicatas CAPI por `(tenantId, eventId)`
- **DispatchAttempt** — log de tentativas de envio ao Meta CAPI com status/error
- **SetupSession** — sessões do wizard de onboarding (state, checks, issues em JSON)

### Stories Ativas

| Story | Status | Descrição |
|-------|--------|-----------|
| story-track-ai-001 | Done | Setup wizard + API sessions |
| story-track-ai-002 | Done | Secrets + AWS API Gateway + WAF |
| story-track-ai-003 | Done | Deploy ECS Fargate + observabilidade |
| story-track-ai-004 | InProgress | Click ingestion (`POST /api/v1/track/click`) |
| story-track-ai-005 | InReview | PerfectPay webhook HMAC-SHA256 |

Próximas (backlog): outros gateways (006), match engine (007), SQS dispatch (008), dashboard (009), replay (010).

### Padrões do Projeto

- Validação de entrada sempre via **Zod schemas** do `packages/shared` — nunca validar manualmente
- Handlers Fastify exportam `register(app, opts)` — nunca instanciam o server diretamente
- HMAC-SHA256 para autenticação de webhooks (ver `perfectpay-webhook-handler.ts`)
- Hashing de PII (email, phone) antes de persistir — conformidade LGPD
- Commits referenciam story: `feat: implement click handler [story-track-ai-004]`
<!-- PROJECT-CONTEXT-END: hub-server-side-tracking -->
