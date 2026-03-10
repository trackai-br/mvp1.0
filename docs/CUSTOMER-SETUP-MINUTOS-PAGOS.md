# 📱 Setup Guide — MINUTOS PAGOS
## Track AI Server-Side Tracking Integration

**Generated:** 2026-03-10
**Customer:** MINUTOS PAGOS
**Gateway:** PerfectPay
**Website:** institutonexxa.com

---

## ✅ Seu Account foi Criado!

### Dados da Sua Conta

```
Tenant ID:    cmmksm8gj0000itjkwyifhoa2
Funnel Name:  Minutos Pagos - Instituton Nexxa
Webhook URL:  https://api.track-ai.com/api/v1/webhooks/perfectpay/cmmksm8gj0000itjkwyifhoa2
```

---

## 🎯 PASSO 1: Instalar Tracking Pixel no Seu Site

### 1.1 — Copie este código:

```javascript
<!-- Track AI Pixel - 2026-03-10T15:56:52.091Z -->
<script async>
  (function() {
    window.__trackAI = window.__trackAI || {};
    window.__trackAI.tenantId = 'cmmksm8gj0000itjkwyifhoa2';

    // Extract URL parameters
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get('fbclid');
    const fbc = params.get('fbc') || localStorage.getItem('_fbc');
    const fbp = params.get('fbp') || localStorage.getItem('_fbp');

    // Capture Meta pixel data if available
    const metaData = {
      fbclid,
      fbc,
      fbp,
      url: window.location.href,
      referrer: document.referrer
    };

    // Send click event
    fetch('https://api.track-ai.com/api/v1/track/click', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': window.__trackAI.tenantId
      },
      body: JSON.stringify(metaData)
    }).catch(err => console.error('Track AI:', err));
  })();
</script>
```

### 1.2 — Onde Colar?

**Coloque NO `<head>` do seu site (antes de `</head>`):**

```html
<!DOCTYPE html>
<html>
<head>
  <!-- ... seus outros scripts ... -->
  
  <!-- Track AI Pixel - COLE AQUI -->
  <script async>
    (function() {
      window.__trackAI = window.__trackAI || {};
      window.__trackAI.tenantId = 'cmmksm8gj0000itjkwyifhoa2';
      // ... resto do código ...
    })();
  </script>
  
</head>
<body>
  <!-- seu conteúdo -->
</body>
</html>
```

### 1.3 — Se Usar Google Tag Manager (GTM)

1. Abra sua conta GTM
2. Crie uma **Custom HTML Tag**
3. Cole o código acima
4. Trigger: **All Pages**
5. Deploy

---

## 🔧 PASSO 2: Configurar Webhook de Conversão

### 2.1 — Informar ao PerfectPay

Quando uma venda é confirmada no PerfectPay, você precisa enviar os dados de conversão para:

```
URL:    https://api.track-ai.com/api/v1/webhooks/perfectpay/cmmksm8gj0000itjkwyifhoa2
Método: POST
Header: x-perfectpay-signature: [HMAC-SHA256]
Body:   {
          "order_id": "...",
          "customer": {
            "email": "...",
            "phone": "..."
          },
          "amount": 199.90,
          "currency": "BRL",
          "status": "approved"
        }
```

### 2.2 — Gerar HMAC Signature

```bash
# Secret (mantenha seguro!)
WEBHOOK_SECRET="eecb790d368d3a21b31f67313de4ffee"

# Payload JSON
PAYLOAD='{"order_id":"minutos-001","customer":{"email":"user@example.com","phone":"+55..."},"amount":199.90,"currency":"BRL","status":"approved"}'

# Gerar assinatura
echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$WEBHOOK_SECRET"
```

### 2.3 — Alternativa: Use Nossa API REST

Se o PerfectPay já envia webhook, você pode nos configurar para receber automaticamente.
Entre em contato: support@track-ai.com

---

## ✅ PASSO 3: Testar Tudo

### 3.1 — Verificar Pixel no Browser

1. Abra seu site em Chrome
2. Abra DevTools (F12)
3. Vá na aba **Network**
4. Procure por requisições para `api.track-ai.com/api/v1/track/click`
5. Se vir → Pixel está funcionando! ✅

### 3.2 — Monitorar Conversões

Acesse nosso dashboard:
```
https://dashboard.track-ai.com/analytics?tenant=cmmksm8gj0000itjkwyifhoa2
```

---

## 🚨 Troubleshooting

### Pixel não está sendo carregado

**Problema:** Script retorna erro de CORS ou timeout
**Solução:** 
- Verifique se `tenantId` está correto (cmmksm8gj0000itjkwyifhoa2)
- Verifique console do browser (F12 → Console)

### Conversões não aparecem

**Problema:** Webhook sendo enviado mas conversão não aparece
**Solução:**
- Verifique se HMAC signature está correta
- Verifique se `order_id` é único por venda
- Verifique logs em: https://dashboard.track-ai.com/logs

### Não temos endpoint PerfectPay?

**Problema:** Seu gateway não é PerfectPay
**Solução:**
- Você pode enviar webhooks manualmente para nosso endpoint
- Ou entre em contato para configurar seu gateway específico

---

## 📞 Suporte

**Email:** guilhermesimas542@gmail.com
**Dashboard:** https://dashboard.track-ai.com
**Webhook URL:** https://api.track-ai.com/api/v1/webhooks/perfectpay/cmmksm8gj0000itjkwyifhoa2

---

## ✅ Checklist Final

- [ ] Pixel instalado no `<head>` do site
- [ ] Pixel testado no browser (Network tab)
- [ ] Webhook configurado no PerfectPay
- [ ] HMAC signature sendo enviada corretamente
- [ ] Conversões aparecendo no dashboard
- [ ] Primeira conversão testada e confirmada

**Depois de completar:** Sua conta estará 100% funcional! 🎉

---
