type CartItem = {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
};

type CheckoutData = {
  tenantId: string;
  cartValue?: number | null;
  currency?: string | null;
  cartItems?: CartItem[] | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  fbclid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type CheckoutHandlerDeps = {
  findTenant?: (id: string) => Promise<{ id: string } | null>;
  createCheckout?: (data: CheckoutData) => Promise<{ id: string }>;
};

type CheckoutBody = Partial<Omit<CheckoutData, 'tenantId'>>;

export async function handleCheckoutIngest(
  tenantId: string,
  body: CheckoutBody,
  ip: string | undefined,
  userAgent: string | undefined,
  deps: CheckoutHandlerDeps = {}
): Promise<
  | { ok: true; id: string }
  | { error: 'tenant_not_found' }
> {
  // Generate CUID-like ID
  const generateId = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 25; i++) {
      id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
  };

  // Import Prisma for defaults
  const { prisma } = await import('./db.js');

  // 1. Verificar tenant (use raw SQL)
  const findTenant = deps.findTenant ?? (async (id: string) => {
    const result = await prisma.$queryRaw<[{ id: string }]>`
      SELECT id FROM "Tenant" WHERE id = ${id} LIMIT 1
    `;
    return result.length > 0 ? result[0] : null;
  });

  const tenant = await findTenant(tenantId);
  if (!tenant) {
    return { error: 'tenant_not_found' };
  }

  // 2. Persistir checkout (use raw SQL)
  const checkoutId = generateId();

  const createCheckout = deps.createCheckout ?? (async (data: CheckoutData) => {
    await prisma.$executeRaw`
      INSERT INTO "Checkout" (id, "tenantId", "cartValue", currency, "cartItems", "utmSource", "utmMedium", "utmCampaign", fbclid, fbc, fbp, ip, "userAgent", "createdAt")
      VALUES (${checkoutId}, ${data.tenantId}, ${data.cartValue ?? null}, ${data.currency ?? null}, ${data.cartItems ?? null},
              ${data.utmSource ?? null}, ${data.utmMedium ?? null}, ${data.utmCampaign ?? null},
              ${data.fbclid ?? null}, ${data.fbc ?? null}, ${data.fbp ?? null}, ${data.ip ?? null},
              ${data.userAgent ?? null}, NOW())
    `;
    return { id: checkoutId };
  });

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
