import type { Prisma } from '@prisma/client';
import { prisma } from './db.js';

export type CheckoutHandlerDeps = {
  findTenant?: (id: string) => Promise<{ id: string } | null>;
  createCheckout?: (data: {
    tenantId: string;
    cartValue?: number | null;
    currency?: string;
    cartItems?: Prisma.InputJsonValue;
    utmSource?: string | null;
    utmMedium?: string | null;
    utmCampaign?: string | null;
    fbclid?: string | null;
    fbc?: string | null;
    fbp?: string | null;
    ip?: string | null;
    userAgent?: string | null;
  }) => Promise<{ id: string }>;
};

type CheckoutBody = {
  cartValue?: number | null;
  currency?: string;
  cartItems?: Prisma.InputJsonValue;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  fbclid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
};

export async function handleCheckoutIngest(
  tenantId: string,
  body: CheckoutBody,
  ip: string | undefined,
  userAgent: string | undefined,
  deps: CheckoutHandlerDeps = {}
): Promise<{ ok: true; id: string } | { error: 'tenant_not_found' }> {
  const findTenant = deps.findTenant ?? ((id) => prisma.tenant.findUnique({ where: { id } }));
  const createCheckout = deps.createCheckout ?? ((data) => prisma.checkout.create({ data }));

  const tenant = await findTenant(tenantId);
  if (!tenant) {
    return { error: 'tenant_not_found' };
  }

  const checkout = await createCheckout({
    tenantId: tenant.id,
    cartValue: body.cartValue,
    currency: body.currency,
    cartItems: body.cartItems,
    utmSource: body.utmSource,
    utmMedium: body.utmMedium,
    utmCampaign: body.utmCampaign,
    fbclid: body.fbclid,
    fbc: body.fbc,
    fbp: body.fbp,
    ip,
    userAgent,
  });

  return { ok: true, id: checkout.id };
}
