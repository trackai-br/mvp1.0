export type CheckoutHandlerDeps = {
  findTenant?: (id: string) => Promise<{ id: string } | null>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createCheckout?: (data: any) => Promise<{ id: string }>;
};

export async function handleCheckoutIngest(
  tenantId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
  ip: string | undefined,
  userAgent: string | undefined,
  deps: CheckoutHandlerDeps = {}
): Promise<
  | { ok: true; id: string }
  | { error: 'tenant_not_found' }
> {
  // Import Prisma for defaults
  const { prisma } = await import('./db.js');

  // 1. Verificar tenant
  const findTenant = deps.findTenant ?? ((id: string) => prisma.tenant.findUnique({ where: { id } }));
  const tenant = await findTenant(tenantId);
  if (!tenant) {
    return { error: 'tenant_not_found' };
  }

  // 2. Persistir checkout com captura de IP, user agent e items do carrinho
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createCheckout = deps.createCheckout ?? ((data: any) => prisma.checkout.create({ data }));

  const result = await createCheckout({
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

  return { ok: true, id: result.id };
}
