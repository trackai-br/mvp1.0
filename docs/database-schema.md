## Banco de Dados Track AI — Schema Inicial

### Modelos principais

1. **tenants**  
   - `id`: texto (cuid)  
   - `slug`: identificador único do cliente  
   - `status`: enum (`provisioning`, `active`, `suspended`, `retired`)  
   - `created_at`, `updated_at`: timestamps  
   - Relacionamentos: `funnels`, `clicks`, `identities`, `dedupe_registry`, `dispatch_attempts`, `setup_sessions`.

2. **funnels**  
   - Link com tenant + status textual (`draft`, `active`).  
   - Auditoria de criação/atualização.

3. **clicks**  
   - Registro de cliques do funil (fbclid, fbc, fbp, UTMs, IP, User-Agent).  
   - Index único por tenant+fbclid/fbc para acelerar matching + dedupe.  
   - `created_at` com default `now()`.

4. **identities**  
   - Armazena `email_hash` e `phone_hash` a partir dos dados do lead (SHA-256).  
   - Indexes compostos com `tenant_id` para permitir buscas determinísticas (Stage 1 do match).

5. **dedupe_registry**  
   - Garante que `event_id = sha256(tenant_id | order_id | event_name | value | currency)` só exista uma vez.  
   - Constraint única `(tenant_id, event_id)` e foreign key com `tenants`.

6. **dispatch_attempts**  
   - Log de cada tentativa de envio ao Meta CAPI.  
   - Index em `(tenant_id, event_id)` + `tenant_id` isolado.  
   - `status` enum (`pending`, `success`, `failed`) com circuit breaker que bloqueia novos envios após 10 falhas consecutivas.

7. **setup_sessions**  
   - Armazena o estado do wizard (incluindo `issues` e `input` como JSON).  
   - Pode referenciar `tenant_id` quando o provisionamento já estiver em andamento.

### Extensões e configurações
- `CREATE EXTENSION IF NOT EXISTS "pgcrypto";` para `gen_random_uuid`.  
- A solução usa `Prisma 7` com `schema.prisma` + `prisma.config.ts`.

### Migração inicial
- `apps/api/prisma/migrations/20260220000000_init/migration.sql` cria todas as tabelas + enums + indexes listados acima.  
- Indexes críticos:  
  - `clicks(tenant_id, fbc)` e `clicks(tenant_id, fbclid)`  
  - `identities(tenant_id, email_hash)` e `identities(tenant_id, phone_hash)`  
  - `dispatch_attempts(tenant_id)` e `(tenant_id, event_id)`  
  - `dedupe_registry(tenant_id, event_id)` (constraint única)

### Próximos passos recomendados
- Executar `npm run prisma:migrate` apontando para um Postgres de dev (variável `DB_URL`), validando os indexes com `EXPLAIN ANALYZE`.  
- Conectar `PrismaClient` ao backend para gravar `clicks`, `identities`, `dispatch_attempts` e `setup_sessions`.
- Garantir que todos os secrets estejam no `.env` local e na AWS Secrets Manager antes do deploy.
