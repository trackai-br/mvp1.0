import type { ClickIngestInput } from '@hub/shared';
import { prisma } from './db';

export type ClickHandlerDeps = {
  findTenant?: (id: string) => Promise<{ id: string } | null>;
  createClick?: (data: {
    tenantId: string;
    fbclid?: string;
    fbc?: string;
    fbp?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    ip?: string;
    userAgent?: string;
  }) => Promise<{ id: string }>;
};

export async function handleClickIngest(
  tenantId: string,
  body: ClickIngestInput,
  request: { ip?: string; headers: Record<string, string | string[] | undefined> },
  deps: ClickHandlerDeps = {}
): Promise<{ id: string } | { error: 'tenant_not_found' }> {
  const findTenant = deps.findTenant ?? ((id) => prisma.tenant.findUnique({ where: { id } }));
  const createClick = deps.createClick ?? ((data) => prisma.click.create({ data }));

  const tenant = await findTenant(tenantId);
  if (!tenant) {
    return { error: 'tenant_not_found' };
  }

  const userAgent = request.headers['user-agent'];
  const ip = request.ip ?? (request.headers['x-forwarded-for'] as string | undefined);

  const click = await createClick({
    tenantId: tenant.id,
    fbclid: body.fbclid,
    fbc: body.fbc,
    fbp: body.fbp,
    utmSource: body.utmSource,
    utmMedium: body.utmMedium,
    utmCampaign: body.utmCampaign,
    ip,
    userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
  });

  return { id: click.id };
}
