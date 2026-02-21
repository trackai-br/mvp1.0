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
  // 1. Verificar tenant
  if (!deps.findTenant) {
    throw new Error('findTenant dependency is required');
  }
  const tenant = await deps.findTenant(tenantId);
  if (!tenant) {
    return { error: 'tenant_not_found' };
  }

  // 2. Persistir checkout com captura de IP, user agent e items do carrinho
  if (!deps.createCheckout) {
    throw new Error('createCheckout dependency is required');
  }
  const createCheckout = deps.createCheckout;

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
