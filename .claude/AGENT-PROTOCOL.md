# 🤖 Protocolo para Agentes — hub-server-side-tracking

**VERSÃO:** 1.0
**EFETIVA DESDE:** 2026-03-02

---

## ⚡ PROTOCOLO OBRIGATÓRIO

Toda ação de um agente DEVE seguir esta sequência:

### Passo 1: LER PROGRESS.md
```bash
cat PROGRESS.md
```
**Objetivo:** Entender:
- Status atual (✅ OK / 🔴 BLOQUEADO)
- Problemas conhecidos
- Docker/Banco: qual existe, qual esperado
- Bloqueadores que impedem ação

### Passo 2: AVALIAR SE PODE AGIR
- Se `Status: BLOQUEADO` → **PARAR** e relatar bloqueador
- Se há problemas de **Docker/Banco** → NÃO prosseguir com código
- Se está tudo OK → Ir para Passo 3

### Passo 3: EXECUTAR AÇÃO
Implementar a tarefa conforme plano

### Passo 4: ATUALIZAR PROGRESS.md
- Adicionar o que foi feito
- Registrar novos bloqueadores
- Atualizar status

---

## 📋 Checklist Antes de Agir

- [ ] Li PROGRESS.md?
- [ ] Identifiquei bloqueadores?
- [ ] Docker está OK?
- [ ] Banco está correto?
- [ ] Tenho permissão para executar?
- [ ] Vou atualizar PROGRESS.md depois?

---

## 🚫 Anti-Padrões (NUNCA faça)

❌ Executar código sem ler PROGRESS.md
❌ Ignorar status BLOQUEADO
❌ Assumir qual banco/container existe
❌ Não atualizar PROGRESS.md após ação
❌ Esconder problemas — comunicar logo

---

## 📞 Quando Pedir Ajuda

**Relatar imediatamente se:**
- Status virou BLOQUEADO
- Erro P1010, TLS, ou conexão
- Docker falhou ou container desapareceu
- Não conseguiu resolver em 2 tentativas

**Formato de relato:**
```
BLOQUEADOR: [descrição]
SINTOMA: [erro exato]
CAUSA: [hipótese]
IMPACTO: [o que não funciona]
PRÓXIMO: [próxima ação recomendada]
```

---

## 👥 Para Todos os Agentes

- @dev, @data-engineer, @qa, @devops, @architect
- Todos devem seguir este protocolo
- Não há exceção

---

**Assinado:** Orion (@aios-master)
**Treinado em:** 2026-03-02 17:58
