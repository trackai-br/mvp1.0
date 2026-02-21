'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { setupSessionCreateSchema, type SetupSessionStatus } from '@/lib/contracts';
import type { CSSProperties } from 'react';
import type { z } from 'zod';

type FormInput = z.infer<typeof setupSessionCreateSchema>;

type WizardStep = 1 | 2 | 3 | 4;

type SourceItem = {
  id: string;
  name: string;
  upgradeRequired?: boolean;
};

type IntegrationItem = {
  id: string;
  name: string;
  upgradeRequired?: boolean;
};

const DATA_SOURCES: SourceItem[] = [
  { id: 'facebook', name: 'Facebook Pixel' },
  { id: 'google-ads', name: 'Google Ads' },
  { id: 'tiktok', name: 'TikTok Pixel' },
  { id: 'bing', name: 'Bing' },
  { id: 'taboola', name: 'Taboola' },
  { id: 'outbrain', name: 'Outbrain' },
  { id: 'ga4', name: 'Google Analytics 4', upgradeRequired: true }
];

const POPULAR_INTEGRATIONS: IntegrationItem[] = [
  { id: 'perfectpay', name: 'Perfect Pay' },
  { id: 'hotmart', name: 'Hotmart', upgradeRequired: true },
  { id: 'kiwify', name: 'Kiwify', upgradeRequired: true },
  { id: 'stripe', name: 'Stripe', upgradeRequired: true },
  { id: 'shopify', name: 'Shopify', upgradeRequired: true }
];

function apiUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_API_URL ?? '';
  return base ? `${base}${path}` : path;
}

async function createSession(payload: FormInput): Promise<SetupSessionStatus> {
  const res = await fetch(apiUrl('/api/v1/setup/sessions'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    throw new Error('Falha ao criar sessao de setup.');
  }

  return res.json();
}

async function validateSession(id: string): Promise<SetupSessionStatus> {
  const res = await fetch(apiUrl(`/api/v1/setup/sessions/${id}/validate`), {
    method: 'POST'
  });

  if (!res.ok) {
    throw new Error('Falha ao validar sessao.');
  }

  return res.json();
}

function statusForStep(currentStep: WizardStep, itemStep: WizardStep): 'pending' | 'in_progress' | 'complete' {
  if (currentStep > itemStep) return 'complete';
  if (currentStep === itemStep) return 'in_progress';
  return 'pending';
}

function StepCircle({ status, index }: { status: 'pending' | 'in_progress' | 'complete'; index: number }) {
  const base: CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 999,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 13
  };

  if (status === 'complete') {
    return <span style={{ ...base, background: '#2563eb', color: '#fff' }}>✓</span>;
  }

  if (status === 'in_progress') {
    return <span style={{ ...base, background: '#2563eb', color: '#fff' }}>{index}</span>;
  }

  return (
    <span
      style={{
        ...base,
        background: '#e5e7eb',
        color: '#6b7280',
        border: '1px solid #d1d5db'
      }}
    >
      {index}
    </span>
  );
}

export default function Home() {
  const [step, setStep] = useState<WizardStep>(1);
  const [detectionDone, setDetectionDone] = useState(false);
  const [selectedInstallMethod, setSelectedInstallMethod] = useState<'gtm' | 'manual' | null>(null);
  const [connectedSources, setConnectedSources] = useState<SourceItem[]>([]);
  const [addedIntegrations, setAddedIntegrations] = useState<IntegrationItem[]>([]);
  const [integrationQuery, setIntegrationQuery] = useState('');
  const [result, setResult] = useState<SetupSessionStatus | null>(null);

  const form = useForm<FormInput>({
    resolver: zodResolver(setupSessionCreateSchema),
    defaultValues: {
      projectName: 'Track AI',
      trackingEnvironment: 'lp',
      landingUrl: 'https://example.com',
      meta: {
        pixelId: '',
        accessToken: '',
        adAccountId: ''
      },
      gateway: {
        platform: 'perfectpay',
        apiKey: '',
        webhookSecret: ''
      }
    },
    mode: 'onBlur'
  });

  const submitMutation = useMutation({
    mutationFn: async (values: FormInput) => {
      const created = await createSession(values);
      return validateSession(created.id);
    },
    onSuccess: (data) => {
      setResult(data);
      setStep(4);
    }
  });

  const errorMessage = useMemo(() => {
    if (!submitMutation.error) return null;
    return submitMutation.error instanceof Error
      ? submitMutation.error.message
      : 'Erro inesperado.';
  }, [submitMutation.error]);

  const filteredIntegrations = useMemo(() => {
    const q = integrationQuery.trim().toLowerCase();
    return POPULAR_INTEGRATIONS.filter((item) => item.name.toLowerCase().includes(q));
  }, [integrationQuery]);

  function connectSource(item: SourceItem) {
    if (item.upgradeRequired) return;
    setConnectedSources((prev) => {
      if (prev.some((s) => s.id === item.id)) return prev;
      return [...prev, item];
    });
  }

  function removeSource(itemId: string) {
    setConnectedSources((prev) => prev.filter((s) => s.id !== itemId));
  }

  function addIntegration(item: IntegrationItem) {
    if (item.upgradeRequired) return;
    setAddedIntegrations((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev;
      return [...prev, item];
    });
  }

  const stepStatusLabel = step === 4 ? '✓ Complete' : 'In progress';

  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
        padding: 24,
        fontFamily: 'ui-sans-serif, system-ui, sans-serif'
      }}
    >
      <div
        style={{
          maxWidth: 1120,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '280px 1fr',
          gap: 16
        }}
      >
        <aside
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 16,
            padding: 16,
            height: 'fit-content',
            position: 'sticky',
            top: 16
          }}
        >
          <h2 style={{ marginTop: 0, marginBottom: 12, fontSize: 18 }}>Track AI Onboarding</h2>
          {[
            'Instalar o Script',
            'Conectar Redes de Anuncios',
            'Conectar Integracoes',
            'Concluido'
          ].map((name, idx) => {
            const itemStep = (idx + 1) as WizardStep;
            const status = statusForStep(step, itemStep);
            return (
              <div
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 8px',
                  borderRadius: 10,
                  background: status === 'in_progress' ? '#eff6ff' : 'transparent'
                }}
              >
                <StepCircle status={status} index={idx + 1} />
                <span style={{ fontWeight: status === 'in_progress' ? 700 : 500, color: '#111827' }}>
                  {name}
                </span>
              </div>
            );
          })}
        </aside>

        <section
          style={{
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 16,
            padding: 20,
            minHeight: 620,
            position: 'relative'
          }}
        >
          <span
            style={{
              position: 'absolute',
              top: 16,
              right: 16,
              fontSize: 12,
              fontWeight: 700,
              color: step === 4 ? '#065f46' : '#1d4ed8',
              background: step === 4 ? '#d1fae5' : '#dbeafe',
              borderRadius: 999,
              padding: '6px 10px'
            }}
          >
            {stepStatusLabel}
          </span>

          <form onSubmit={form.handleSubmit((values) => submitMutation.mutate(values))}>
            {step === 1 && (
              <div>
                <h1 style={{ marginTop: 0 }}>Instalar o Script</h1>
                <p style={{ color: '#4b5563' }}>
                  Informe a URL do seu site para detectar a stack automaticamente.
                </p>

                <label htmlFor="trackingEnvironment">Ambiente</label>
                <select id="trackingEnvironment" {...form.register('trackingEnvironment')}>
                  <option value="lp">Landing Page (LP)</option>
                  <option value="wpp">WhatsApp</option>
                  <option value="telegram">Telegram</option>
                </select>

                <div style={{ marginTop: 12 }}>
                  <label htmlFor="landingUrl">URL do site</label>
                  <input id="landingUrl" {...form.register('landingUrl')} style={{ width: '100%' }} />
                  <p style={{ color: 'crimson' }}>{form.formState.errors.landingUrl?.message}</p>
                </div>

                {!detectionDone ? (
                  <button type="button" onClick={() => setDetectionDone(true)}>
                    SCAN SITE
                  </button>
                ) : (
                  <div style={{ marginTop: 16 }}>
                    <p style={{ marginBottom: 8 }}>
                      Tecnologias detectadas: <strong>Google Tag Manager</strong>
                    </p>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 10
                      }}
                    >
                      <button type="button" onClick={() => setSelectedInstallMethod('gtm')}>
                        Instalar via GTM (detectado)
                      </button>
                      <button type="button" onClick={() => setSelectedInstallMethod('manual')}>
                        Instalar manualmente
                      </button>
                    </div>
                    {selectedInstallMethod === 'manual' && (
                      <pre
                        style={{
                          marginTop: 12,
                          background: '#0f172a',
                          color: '#e2e8f0',
                          padding: 12,
                          borderRadius: 10,
                          overflowX: 'auto'
                        }}
                      >
{`<script src="https://cdn.track-ai.app/script.js" data-project="track-ai"></script>`}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div>
                <h1 style={{ marginTop: 0 }}>Conectar Redes de Anuncios</h1>
                <p style={{ color: '#4b5563' }}>Conecte seus data sources principais.</p>

                <label htmlFor="pixelId">Pixel ID</label>
                <input id="pixelId" {...form.register('meta.pixelId')} style={{ width: '100%' }} />

                <label htmlFor="accessToken">Access Token</label>
                <input id="accessToken" {...form.register('meta.accessToken')} style={{ width: '100%' }} />

                <label htmlFor="adAccountId">Ad Account ID</label>
                <input id="adAccountId" {...form.register('meta.adAccountId')} style={{ width: '100%' }} />

                <h3>Data Sources</h3>
                <div style={{ display: 'grid', gap: 8 }}>
                  {DATA_SOURCES.map((source) => (
                    <div
                      key={source.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        border: '1px solid #e5e7eb',
                        borderRadius: 10,
                        padding: 10
                      }}
                    >
                      <span>{source.name}</span>
                      {source.upgradeRequired ? (
                        <button type="button" disabled>
                          UPGRADE
                        </button>
                      ) : (
                        <button type="button" onClick={() => connectSource(source)}>
                          CONNECT
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {connectedSources.length > 0 && (
                  <>
                    <h3>Added Data Sources</h3>
                    <ul>
                      {connectedSources.map((source) => (
                        <li key={source.id}>
                          <span style={{ color: '#16a34a' }}>●</span> {source.name}{' '}
                          <button type="button" onClick={() => removeSource(source.id)}>
                            REMOVE
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            )}

            {step === 3 && (
              <div>
                <h1 style={{ marginTop: 0 }}>Conectar Integracoes</h1>
                <p style={{ color: '#4b5563' }}>
                  Adicione integracoes e configure as credenciais da Perfect Pay.
                </p>

                <input
                  placeholder="Buscar integracao"
                  value={integrationQuery}
                  onChange={(e) => setIntegrationQuery(e.target.value)}
                  style={{ width: '100%', marginBottom: 12 }}
                />

                {addedIntegrations.length > 0 && (
                  <>
                    <h3>All Added Integrations</h3>
                    <ul>
                      {addedIntegrations.map((item) => (
                        <li key={item.id}>
                          {item.name} <button type="button">SETUP INSTRUCTIONS</button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}

                <h3>Popular Integrations</h3>
                <div style={{ display: 'grid', gap: 8 }}>
                  {filteredIntegrations.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        border: '1px solid #e5e7eb',
                        borderRadius: 10,
                        padding: 10
                      }}
                    >
                      <span>{item.name}</span>
                      {item.upgradeRequired ? (
                        <button type="button" disabled>
                          UPGRADE
                        </button>
                      ) : (
                        <button type="button" onClick={() => addIntegration(item)}>
                          + ADD
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <input type="hidden" {...form.register('gateway.platform')} value="perfectpay" />

                <div style={{ marginTop: 16 }}>
                  <label htmlFor="apiKey">Token/API Key da Perfect Pay</label>
                  <input id="apiKey" {...form.register('gateway.apiKey')} style={{ width: '100%' }} />
                  <p style={{ color: 'crimson' }}>{form.formState.errors.gateway?.apiKey?.message}</p>
                </div>

                <div>
                  <label htmlFor="webhookSecret">Webhook Secret</label>
                  <input
                    id="webhookSecret"
                    {...form.register('gateway.webhookSecret')}
                    style={{ width: '100%' }}
                  />
                  <p style={{ color: 'crimson' }}>{form.formState.errors.gateway?.webhookSecret?.message}</p>
                </div>
              </div>
            )}

            {step === 4 && result && (
              <div style={{ textAlign: 'center', paddingTop: 60 }}>
                <h1>🎉 Concluido</h1>
                <p>Seu setup inicial foi processado com sucesso.</p>
                <p>
                  Estado: <strong>{result.state}</strong>
                </p>
                <p>Webhook Perfect Pay:</p>
                <input readOnly value={result.webhook.url} style={{ width: '100%', fontFamily: 'monospace' }} />
                <p style={{ color: '#4b5563' }}>
                  Use esta URL para configurar o endpoint na Perfect Pay.
                </p>
                <button type="button">GO TO DASHBOARD</button>
                {result.issues.length > 0 && (
                  <ul style={{ textAlign: 'left', marginTop: 16 }}>
                    {result.issues.map((issue) => (
                      <li key={issue}>{issue}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {step < 4 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
                <button type="button" onClick={() => setStep((s) => (s > 1 ? ((s - 1) as WizardStep) : 1))}>
                  BACK
                </button>

                {step === 1 && (
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!detectionDone || selectedInstallMethod === null}
                  >
                    I'VE ADDED THE SCRIPT
                  </button>
                )}

                {step === 2 && (
                  <button type="button" onClick={() => setStep(3)}>
                    SET UP INTEGRATIONS
                  </button>
                )}

                {step === 3 && (
                  <button type="submit" disabled={submitMutation.isPending}>
                    {submitMutation.isPending ? 'PROCESSING...' : 'CONTINUE'}
                  </button>
                )}
              </div>
            )}

            {errorMessage && <p style={{ color: 'crimson' }}>{errorMessage}</p>}
          </form>
        </section>
      </div>
    </main>
  );
}
