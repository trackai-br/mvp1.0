export type PageviewHandlerDeps = {
  findTenant?: (id: string) => Promise<{ id: string } | null>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createPageview?: (data: any) => Promise<{ id: string }>;
};

export async function handlePageviewIngest(
  tenantId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: any,
  ip: string | undefined,
  userAgent: string | undefined,
  deps: PageviewHandlerDeps = {}
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

  // 2. Persistir pageview com captura de IP e user agent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const createPageview = deps.createPageview ?? ((data: any) => prisma.pageview.create({ data }));

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
