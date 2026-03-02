import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Criar diretório de screenshots
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

test('Setup Wizard - Complete Onboarding Flow', async ({ page }) => {
  // ===== STEP 1: Instalar o Script =====
  console.log('\n📍 STEP 1: Install Script...');
  await page.goto(BASE_URL);

  // Validar STEP 1
  await expect(page.getByRole('heading', { level: 1, name: /Instalar/ }), { timeout: 10000 }).toBeVisible();
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-step1-initial.png') });

  // Clicar SCAN SITE
  await page.getByRole('button', { name: /SCAN SITE/i }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-step1-scan-done.png') });

  // Selecionar GTM
  await page.getByRole('button', { name: /Instalar via GTM/i }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-step1-gtm-selected.png') });

  // Avançar para STEP 2
  await page.getByRole('button', { name: /I'VE ADDED THE SCRIPT/i }).click();
  await page.waitForTimeout(800);

  // ===== STEP 2: Conectar Redes de Anúncios =====
  console.log('📍 STEP 2: Connect Ad Networks...');

  // Esperar até que apareça o h1 de STEP 2
  await page.getByRole('heading', { level: 1, name: /Conectar Redes/ }).waitFor({ timeout: 5000 });
  await expect(page.getByRole('heading', { level: 1, name: /Conectar Redes/ })).toBeVisible();
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-step2-start.png') });

  // Preencher Meta credentials (must meet validation requirements)
  await page.locator('input#pixelId').fill('123456789');
  await page.locator('input#accessToken').fill('mock_token_abc123xyz_1234567890'); // >= 10 chars
  await page.locator('input#adAccountId').fill('act_987654321');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-step2-meta-filled.png') });

  // Conectar Facebook (procura por botão CONNECT perto de Facebook Pixel)
  const buttons = await page.locator('button:has-text("CONNECT")').all();
  // Facebook é o primeiro
  await buttons[0].click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-step2-facebook-connected.png') });

  // Avançar para STEP 3
  await page.getByRole('button', { name: /SET UP INTEGRATIONS/i }).click();
  await page.waitForTimeout(500);

  // ===== STEP 3: Conectar Integrações =====
  console.log('📍 STEP 3: Setup Integrations...');
  await expect(page.getByRole('heading', { level: 1, name: /Conectar Integra/ })).toBeVisible();
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-step3-start.png') });

  // Adicionar Perfect Pay - procurar botão ADD perto de "Perfect Pay"
  const addButtons = await page.locator('button:has-text("+ ADD")').all();
  if (addButtons.length > 0) {
    await addButtons[0].click(); // Perfect Pay é o primeiro
    await page.waitForTimeout(300);
  }

  // Preencher gateway (must meet validation requirements)
  await page.locator('select#gateway').selectOption('perfectpay');
  await page.locator('input#apiKey').fill('mock_key_perfectpay_123456789'); // >= 8 chars
  await page.locator('input#webhookSecret').fill('mock_secret_perfectpay_456789');
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08-step3-gateway-filled.png') });

  // Submit form
  const submitButton = page.getByRole('button', { name: /CONTINUE/i });
  await expect(submitButton).toBeEnabled();

  // Espiar resposta (opcional)
  const responsePromise = page.waitForResponse(
    response => response.url().includes('/api/v1/setup/sessions')
  ).catch(() => null);

  await submitButton.click();
  await responsePromise;
  await page.waitForTimeout(800);

  // ===== STEP 4: Completo =====
  console.log('📍 STEP 4: Completion...');
  await expect(page.getByRole('heading', { name: /Concluido/i }), { timeout: 10000 }).toBeVisible();
  await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '09-step4-complete.png') });

  // Extrair webhook URL
  const webhookInput = page.locator('input[readonly]').first();
  const webhookUrl = await webhookInput.inputValue();

  console.log('✓ Setup Complete!');
  console.log('✓ Webhook URL:', webhookUrl.substring(0, 100) + '...');

  // Validar webhook
  expect(webhookUrl).toMatch(/\/api\/v1\/webhooks\/perfectpay\//);

  // Salvar resultado
  const result = {
    success: true,
    webhookUrl,
    timestamp: new Date().toISOString(),
    screenshots: [
      '01-step1-initial.png',
      '02-step1-scan-done.png',
      '03-step1-gtm-selected.png',
      '04-step2-start.png',
      '05-step2-meta-filled.png',
      '06-step2-facebook-connected.png',
      '07-step3-start.png',
      '08-step3-gateway-filled.png',
      '09-step4-complete.png'
    ]
  };

  fs.writeFileSync(
    path.join(SCREENSHOTS_DIR, 'test-result.json'),
    JSON.stringify(result, null, 2)
  );

  console.log('✓ All screenshots saved to:', SCREENSHOTS_DIR);
  console.log('✓ Test result saved to:', path.join(SCREENSHOTS_DIR, 'test-result.json'));
});
