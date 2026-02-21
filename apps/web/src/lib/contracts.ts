import { z } from 'zod';

export const trackingEnvironmentSchema = z.enum(['lp', 'wpp', 'telegram']);
export const gatewaySchema = z.enum(['perfectpay']);

export const setupSessionCreateSchema = z.object({
  projectName: z.string().min(1),
  trackingEnvironment: trackingEnvironmentSchema,
  landingUrl: z.string().url(),
  meta: z.object({
    pixelId: z.string().min(3),
    accessToken: z.string().min(10),
    adAccountId: z.string().min(3)
  }),
  gateway: z.object({
    platform: gatewaySchema,
    apiKey: z.string().min(8),
    webhookSecret: z.string().min(8)
  })
});

export const stepStatusSchema = z.enum(['pending', 'ok', 'failed']);

export const setupSessionStatusSchema = z.object({
  id: z.string(),
  projectName: z.string(),
  state: z.enum(['created', 'validated', 'troubleshooting_required']),
  createdAt: z.string(),
  updatedAt: z.string(),
  input: setupSessionCreateSchema,
  webhook: z.object({
    provider: gatewaySchema,
    path: z.string(),
    url: z.string().url(),
    token: z.string()
  }),
  checks: z.object({
    gatewayCredentials: stepStatusSchema,
    metaToken: stepStatusSchema,
    landingProbe: stepStatusSchema
  }),
  issues: z.array(z.string())
});

export type SetupSessionCreateInput = z.infer<typeof setupSessionCreateSchema>;
export type SetupSessionStatus = z.infer<typeof setupSessionStatusSchema>;
