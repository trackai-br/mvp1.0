import { z } from 'zod';

export const trackingEnvironmentSchema = z.enum(['lp', 'wpp', 'telegram']);
export const gatewaySchema = z.enum(['perfectpay', 'hotmart', 'kiwify', 'stripe', 'pagseguro']);

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
    // Contact info (for hashing)
    email: z.string().optional(),
    phone: z.string().optional(),
    // Personal info (for hashing)
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    date_of_birth: z.string().optional(), // YYYY-MM-DD
    // Address (for hashing)
    address_city: z.string().optional(),
    address_state: z.string().optional(),
    address_country: z.string().optional(),
    address_zipcode: z.string().optional(),
    // External ID (for hashing)
    external_id: z.string().optional(),
    // Facebook Login ID
    facebook_login_id: z.string().optional(),
  }).optional(),
  // Purchase data
  amount: z.number().optional(),
  currency: z.string().optional(),
  status: z.string().optional(),
  event_time: z.string().optional(),
  product_id: z.string().optional(),
  // Facebook IDs (NOT hashed)
  fbc: z.string().optional(),
  fbp: z.string().optional(),
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

// Webhook schemas for multiple gateways
export const hotmartWebhookSchema = z.object({
  id: z.string().min(1), // event ID
  status: z.string(), // 'approved', 'processing', 'refunded', etc.
  purchase: z.object({
    id: z.string(),
    full_price: z.number().optional(),
    price: z.number().optional(),
    original_price: z.number().optional(),
    currency: z.string().default('BRL'),
    approved_date: z.string().optional(),
  }).optional(),
  buyer: z.object({
    // Contact info (for hashing)
    email: z.string().optional(),
    phone: z.string().optional(),
    // Personal info (for hashing)
    name: z.string().optional(),
    birth_date: z.string().optional(), // YYYY-MM-DD
    document: z.string().optional(),
    // Address (for hashing)
    address: z.object({
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      zip_code: z.string().optional(),
    }).optional(),
    doc: z.string().optional(),
  }).optional(),
  product: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
  }).optional(),
  // Facebook IDs (NOT hashed)
  fbc: z.string().optional(),
  fbp: z.string().optional(),
});

export type HotmartWebhookBody = z.infer<typeof hotmartWebhookSchema>;

export const kiwifyWebhookSchema = z.object({
  event: z.string(), // 'sale.confirmed', 'refund.requested', etc.
  id: z.string().min(1), // event ID
  timestamp: z.string().optional(),
  data: z.object({
    id: z.string().optional(),
    status: z.string().optional(), // 'confirmed', 'completed', 'cancelled'
    amount: z.number().optional(),
    currency: z.string().default('BRL').optional(),
    customer: z.object({
      // Contact info (for hashing)
      email: z.string().optional(),
      phone: z.string().optional(),
      // Personal info (for hashing)
      name: z.string().optional(),
      birth_date: z.string().optional(), // YYYY-MM-DD
      document: z.string().optional(),
      // Address (for hashing)
      address: z.object({
        city: z.string().optional(),
        state: z.string().optional(),
        country: z.string().optional(),
        zip_code: z.string().optional(),
      }).optional(),
    }).optional(),
    product: z.object({
      id: z.string().optional(),
      name: z.string().optional(),
    }).optional(),
    // Facebook IDs (NOT hashed)
    fbc: z.string().optional(),
    fbp: z.string().optional(),
  }).optional(),
});

export type KiwifyWebhookBody = z.infer<typeof kiwifyWebhookSchema>;

export const stripeWebhookSchema = z.object({
  id: z.string(), // event ID (evt_...)
  type: z.string(), // 'payment_intent.succeeded', 'charge.succeeded', etc.
  created: z.number().optional(), // Unix timestamp
  livemode: z.boolean().optional(),
  data: z.object({
    object: z.object({
      id: z.string().optional(), // payment intent or charge ID
      object: z.string().optional(), // 'payment_intent' or 'charge'
      amount: z.number().optional(), // in cents
      currency: z.string().default('usd').optional(),
      status: z.string().optional(), // 'succeeded', 'processing', etc.
      customer: z.string().optional(), // customer ID (cus_...)
      metadata: z.record(z.string(), z.any()).optional(), // custom metadata (external_id, fbc, fbp, etc)
      charges: z.object({
        data: z.array(z.object({
          id: z.string().optional(),
          amount: z.number().optional(),
          billing_details: z.object({
            // Contact info (for hashing)
            email: z.string().optional(),
            phone: z.string().optional(),
            // Personal info (for hashing)
            name: z.string().optional(),
            // Address (for hashing)
            address: z.object({
              city: z.string().optional(),
              state: z.string().optional(),
              country: z.string().optional(),
              postal_code: z.string().optional(),
            }).optional(),
          }).optional(),
        })).optional(),
      }).optional(),
    }).optional(),
  }).optional(),
});

export type StripeWebhookBody = z.infer<typeof stripeWebhookSchema>;

export const pagseguroWebhookSchema = z.object({
  id: z.string().min(1), // notification ID
  reference: z.string().optional(), // external reference / order_id
  status: z.string().optional(), // '3' = pagto, '13' = devolvido
  grossAmount: z.string().optional(),
  netAmount: z.string().optional(),
  feeAmount: z.string().optional(),
  currency: z.string().default('BRL').optional(),
  lastEventDate: z.string().optional(),
  transactions: z.array(z.object({
    code: z.string().optional(),
    status: z.string().optional(),
    grossAmount: z.string().optional(),
  })).optional(),
  items: z.array(z.object({
    id: z.string().optional(),
    description: z.string().optional(),
    quantity: z.string().optional(),
    amount: z.string().optional(),
  })).optional(),
  sender: z.object({
    // Contact info (for hashing)
    email: z.string().optional(),
    phone: z.object({
      areaCode: z.string().optional(),
      number: z.string().optional(),
    }).optional(),
    // Personal info (for hashing)
    name: z.object({
      givenName: z.string().optional(),
      familyName: z.string().optional(),
    }).optional(),
    birth_date: z.string().optional(), // YYYY-MM-DD
    // Address (for hashing)
    address: z.object({
      city: z.string().optional(),
      state: z.string().optional(),
      country: z.string().optional(),
      postalCode: z.string().optional(),
      street: z.string().optional(),
      number: z.string().optional(),
    }).optional(),
    documents: z.array(z.object({
      type: z.string().optional(), // 'CPF', 'CNPJ'
      value: z.string().optional(),
    })).optional(),
  }).optional(),
  // Facebook IDs (NOT hashed)
  fbc: z.string().optional(),
  fbp: z.string().optional(),
});

export type PagSeguroWebhookBody = z.infer<typeof pagseguroWebhookSchema>;
