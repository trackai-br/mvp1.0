import { prisma } from './db.js';

export type PageviewHandlerDeps = {
  findTenant?: (id: string) => Promise<{ id: string } | null>;
  createPageview?: (data: {
    tenantId: string;
    url: string;
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
  }) => Promise<{ id: string }>;
};

type PageviewBody = {
  url: string;
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
};

export async function handlePageviewIngest(
  tenantId: string,
  body: PageviewBody,
  ip: string | undefined,
  userAgent: string | undefined,
  deps: PageviewHandlerDeps = {}
): Promise<{ ok: true; id: string } | { error: 'tenant_not_found' }> {
  const findTenant = deps.findTenant ?? ((id) => prisma.tenant.findUnique({ where: { id } }));
  const createPageview = deps.createPageview ?? ((data) => prisma.pageview.create({ data }));

  const tenant = await findTenant(tenantId);
  if (!tenant) {
    return { error: 'tenant_not_found' };
  }

  const pageview = await createPageview({
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

  return { ok: true, id: pageview.id };
}
