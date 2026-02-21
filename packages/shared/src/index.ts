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

export type SetupSessionCreateInput = z.infer<typeof setupSessionCreateSchema>;

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

export type SetupSessionStatus = z.infer<typeof setupSessionStatusSchema>;

export const perfectPayWebhookSchema = z.object({
  order_id: z.string().min(1),
  customer: z.object({
    email: z.string().optional(),
    phone: z.string().optional(),
  }).optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  event_time: z.string().optional(),
  product_id: z.string().optional(),
});

export type PerfectPayWebhookBody = z.infer<typeof perfectPayWebhookSchema>;

export const clickIngestSchema = z.object({
  fbclid: z.string().optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
});

export type ClickIngestInput = z.infer<typeof clickIngestSchema>;

export const pageviewIngestSchema = z.object({
  url: z.string().url(),
  referrer: z.string().url().optional(),
  title: z.string().optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  utmContent: z.string().optional(),
  utmTerm: z.string().optional(),
  fbclid: z.string().optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
});

export type PageviewIngestInput = z.infer<typeof pageviewIngestSchema>;

export const checkoutIngestSchema = z.object({
  cartValue: z.number().positive().optional(),
  currency: z.string().length(3).default('BRL'),
  cartItems: z.array(z.object({
    productId: z.string(),
    productName: z.string(),
    quantity: z.number().positive(),
    unitPrice: z.number().positive(),
  })).optional(),
  utmSource: z.string().optional(),
  utmMedium: z.string().optional(),
  utmCampaign: z.string().optional(),
  fbclid: z.string().optional(),
  fbc: z.string().optional(),
  fbp: z.string().optional(),
});

export type CheckoutIngestInput = z.infer<typeof checkoutIngestSchema>;
