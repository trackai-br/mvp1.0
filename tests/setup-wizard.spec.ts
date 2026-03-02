import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');

// Criar diretório de screenshots
if (!fs.existsSync(SCREENSHOTS_DIR)) {
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

test.describe('Setup Wizard - Onboarding Flow', () => {
  let sessionId: string;
  let webhookUrl: string;

  test('STEP 1: Install Script - Should load and allow proceeding', async ({ page }) => {
    await page.goto(BASE_URL);

    // Validar que STEP 1 está visível
    await expect(page.getByRole('heading', { name: /Instalar o Script/i })).toBeVisible();

    // Verificar form preenchida com defaults
    const landingUrlInput = page.locator('input[id="landingUrl"]');
    await expect(landingUrlInput).toHaveValue('https://example.com');

    // Tirar screenshot STEP 1
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-step1-initial.png') });

    // Click SCAN SITE
    await page.click('button:has-text("SCAN SITE")');
    await page.waitForTimeout(500); // Simular detecção

    // Tirar screenshot após detection
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-step1-detected.png') });

    // Verificar botões de instalação aparecem
    const gtmlButton = page.getByText('Instalar via GTM');
    const manualButton = page.getByText('Instalar manualmente');

    await expect(gtmlButton).toBeVisible();
    await expect(manualButton).toBeVisible();

    // Selecionar GTM
    await gtmlButton.click();

    // Tirar screenshot com GTM selecionado
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '03-step1-gtm-selected.png') });

    // Click "I'VE ADDED THE SCRIPT"
    const nextButton = page.getByRole('button', { name: /I'VE ADDED THE SCRIPT/i });
    await expect(nextButton).toBeEnabled();
    await nextButton.click();

    // Validar transição para STEP 2
    await expect(page.getByRole('heading', { name: /Conectar Redes de Anúncios/i })).toBeVisible();
    console.log('✓ STEP 1 passed');
  });

  test('STEP 2: Connect Ad Networks - Should fill Meta credentials', async ({ page }) => {
    await page.goto(BASE_URL);

    // Navegar para STEP 2 (assumindo que voltamos do zero)
    // Click SCAN SITE
    await page.click('button:has-text("SCAN SITE")');
    await page.waitForTimeout(300);

    // Select GTM
    await page.getByText('Instalar via GTM').click();

    // Go to STEP 2
    await page.getByRole('button', { name: /I'VE ADDED THE SCRIPT/i }).click();

    // Verificar STEP 2
    await expect(page.getByRole('heading', { name: /Conectar Redes de Anúncios/i })).toBeVisible();

    // Preencher Meta credentials
    await page.fill('input[id="pixelId"]', '123456789');
    await page.fill('input[id="accessToken"]', 'mock_token_abc123xyz_');
    await page.fill('input[id="adAccountId"]', 'act_987654321');

    // Tirar screenshot com dados preenchidos
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '04-step2-meta-filled.png') });

    // Conectar Facebook
    await page.click('button:has-text("CONNECT"):near(text="Facebook Pixel")');
    await page.waitForTimeout(300);

    // Tirar screenshot com Facebook conectado
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '05-step2-facebook-connected.png') });

    // Click "SET UP INTEGRATIONS"
    const nextButton = page.getByRole('button', { name: /SET UP INTEGRATIONS/i });
    await expect(nextButton).toBeVisible();
    await nextButton.click();

    // Validar transição para STEP 3
    await expect(page.getByRole('heading', { name: /Conectar Integrações/i })).toBeVisible();
    console.log('✓ STEP 2 passed');
  });

  test('STEP 3: Setup Integrations - Fill gateway credentials and submit', async ({ page }) => {
    // Setup completo até STEP 3
    await page.goto(BASE_URL);

    // STEP 1
    await page.click('button:has-text("SCAN SITE")');
    await page.waitForTimeout(300);
    await page.getByText('Instalar via GTM').click();
    await page.getByRole('button', { name: /I'VE ADDED THE SCRIPT/i }).click();

    // STEP 2
    await page.fill('input[id="pixelId"]', '123456789');
    await page.fill('input[id="accessToken"]', 'mock_token_abc123xyz_');
    await page.fill('input[id="adAccountId"]', 'act_987654321');
    await page.click('button:has-text("CONNECT"):near(text="Facebook Pixel")');
    await page.getByRole('button', { name: /SET UP INTEGRATIONS/i }).click();

    // Verificar STEP 3
    await expect(page.getByRole('heading', { name: /Conectar Integrações/i })).toBeVisible();

    // Adicionar integração (Perfect Pay)
    await page.getByText('Perfect Pay').locator('.. >> button:has-text("+ ADD")').click();
    await page.waitForTimeout(300);

    // Tirar screenshot antes de preencher gateway
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '06-step3-before-gateway.png') });

    // Preencher gateway credentials
    await page.selectOption('select[id="gateway"]', 'perfectpay');
    await page.fill('input[id="apiKey"]', 'mock_key_perfectpay_123');
    await page.fill('input[id="webhookSecret"]', 'mock_secret_perfectpay_456');

    // Tirar screenshot com credenciais preenchidas
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '07-step3-gateway-filled.png') });

    // Submit form
    const submitButton = page.getByRole('button', { name: /CONTINUE/i });
    await expect(submitButton).toBeEnabled();

    // Espiar a resposta da API
    const responsePromise = page.waitForResponse(
      response => response.url().includes('/api/v1/setup/sessions')
    );

    await submitButton.click();
    const response = await responsePromise;

    console.log('Setup Sessions Response Status:', response.status());

    // Aguardar STEP 4 (completo)
    await expect(page.getByRole('heading', { name: /Concluido/i }), { timeout: 10000 }).toBeVisible();

    // Tirar screenshot final (STEP 4)
    await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '08-step4-complete.png') });

    // Extrair webhook URL
    const webhookInput = page.locator('input[readonly]');
    webhookUrl = await webhookInput.inputValue();

    console.log('✓ Webhook URL captured:', webhookUrl.substring(0, 80) + '...');
    console.log('✓ STEP 3 passed - Form submitted successfully');
  });

  test('STEP 4: Validate completion and webhook URL', async ({ page }) => {
    // Setup completo até STEP 4
    await page.goto(BASE_URL);

    // STEP 1
    await page.click('button:has-text("SCAN SITE")');
    await page.waitForTimeout(300);
    await page.getByText('Instalar via GTM').click();
    await page.getByRole('button', { name: /I'VE ADDED THE SCRIPT/i }).click();

    // STEP 2
    await page.fill('input[id="pixelId"]', '123456789');
    await page.fill('input[id="accessToken"]', 'mock_token_abc123xyz_');
    await page.fill('input[id="adAccountId"]', 'act_987654321');
    await page.click('button:has-text("CONNECT"):near(text="Facebook Pixel")');
    await page.getByRole('button', { name: /SET UP INTEGRATIONS/i }).click();

    // STEP 3
    await page.getByText('Perfect Pay').locator('.. >> button:has-text("+ ADD")').click();
    await page.waitForTimeout(300);
    await page.selectOption('select[id="gateway"]', 'perfectpay');
    await page.fill('input[id="apiKey"]', 'mock_key_perfectpay_123');
    await page.fill('input[id="webhookSecret"]', 'mock_secret_perfectpay_456');

    // Submit
    const submitButton = page.getByRole('button', { name: /CONTINUE/i });
    await submitButton.click();

    // Aguardar STEP 4
    await expect(page.getByRole('heading', { name: /Concluido/i }), { timeout: 10000 }).toBeVisible();

    // Validar conteúdo STEP 4
    const successMessage = page.getByText(/Seu setup inicial foi processado com sucesso/);
    await expect(successMessage).toBeVisible();

    // Extrair webhook URL
    const webhookInput = page.locator('input[readonly]');
    const webhook = await webhookInput.inputValue();

    // Validar formato webhook
    expect(webhook).toMatch(/\/api\/v1\/webhooks\/perfectpay\//);

    console.log('✓ Webhook URL valid:', webhook.substring(0, 100) + '...');
    console.log('✓ STEP 4 passed - Setup complete');

    // Salvar webhook para query posterior
    fs.writeFileSync(
      path.join(SCREENSHOTS_DIR, 'webhook-output.json'),
      JSON.stringify({ webhookUrl: webhook, timestamp: new Date().toISOString() }, null, 2)
    );
  });
});
