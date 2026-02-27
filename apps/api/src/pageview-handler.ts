type PageviewData = {
  tenantId: string;
  url?: string | null;
  referrer?: string | null;
  title?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  fbclid?: string | null;
  fbc?: string | null;
  fbp?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type PageviewHandlerDeps = {
  findTenant?: (id: string) => Promise<{ id: string } | null>;
  createPageview?: (data: PageviewData) => Promise<{ id: string }>;
};

type PageviewBody = Partial<Omit<PageviewData, 'tenantId'>>;

export async function handlePageviewIngest(
  tenantId: string,
  body: PageviewBody,
  ip: string | undefined,
  userAgent: string | undefined,
  deps: PageviewHandlerDeps = {}
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

  // 2. Persistir pageview com captura de IP e user agent (use raw SQL)
  const pageviewId = generateId();

  const createPageview = deps.createPageview ?? (async (data: PageviewData) => {
    await prisma.$executeRaw`
      INSERT INTO "Pageview" (id, "tenantId", url, referrer, title, "utmSource", "utmMedium", "utmCampaign", "utmContent", "utmTerm", fbclid, fbc, fbp, ip, "userAgent", "createdAt")
      VALUES (${pageviewId}, ${data.tenantId}, ${data.url ?? null}, ${data.referrer ?? null}, ${data.title ?? null},
              ${data.utmSource ?? null}, ${data.utmMedium ?? null}, ${data.utmCampaign ?? null},
              ${data.utmContent ?? null}, ${data.utmTerm ?? null}, ${data.fbclid ?? null}, ${data.fbc ?? null},
              ${data.fbp ?? null}, ${data.ip ?? null}, ${data.userAgent ?? null}, NOW())
    `;
    return { id: pageviewId };
  });

  const result = await createPageview({
    tenantId: tenant.id,
    url: body.url,
    referrer: body.referrer,
    title: body.title,
    utmSource: body.utmSource,
    utmMedium: body.utmMedium,
    utmCampaign: body.utmCampaign,
    utmContent: body.utmContent,
    utmTerm: body.utmTerm,
    fbclid: body.fbclid,
    fbc: body.fbc,
    fbp: body.fbp,
    ip,
    userAgent,
  });

  return { ok: true, id: result.id };
}
