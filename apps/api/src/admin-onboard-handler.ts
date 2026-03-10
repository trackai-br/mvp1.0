import { prisma } from './db.js';

export interface OnboardCustomerRequest {
  companyName: string;
  email: string;
  gateway: 'perfectpay' | 'hotmart' | 'kiwify' | 'stripe';
  funnelName?: string;
  funnelUrl?: string;
}

export interface OnboardCustomerResponse {
  success: boolean;
  tenantId: string;
  funnelId: string;
  tenantSlug: string;
  webhookUrl: string;
  trackingPixelCode: string;
  message: string;
}

function generateSlug(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

function generateTrackingPixelCode(tenantId: string): string {
  return `<!-- Track AI Pixel - ${new Date().toISOString()} -->
<script async>
  (function() {
    window.__trackAI = window.__trackAI || {};
    window.__trackAI.tenantId = '${tenantId}';

    // Extract URL parameters
    const params = new URLSearchParams(window.location.search);
    const fbclid = params.get('fbclid');
    const fbc = params.get('fbc') || localStorage.getItem('_fbc');
    const fbp = params.get('fbp') || localStorage.getItem('_fbp');

    // Capture Meta pixel data if available
    const metaData = {
      fbclid,
      fbc,
      fbp,
      url: window.location.href,
      referrer: document.referrer
    };

    // Send click event
    fetch('https://api.track-ai.com/api/v1/track/click', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-id': window.__trackAI.tenantId
      },
      body: JSON.stringify(metaData)
    }).catch(err => console.error('Track AI:', err));
  })();
</script>`;
}

export async function handleAdminOnboardCustomer(
  req: OnboardCustomerRequest
): Promise<OnboardCustomerResponse> {
  // Validation
  if (!req.companyName?.trim()) {
    throw new Error('companyName is required');
  }
  if (!req.email?.trim()) {
    throw new Error('email is required');
  }
  if (!['perfectpay', 'hotmart', 'kiwify', 'stripe'].includes(req.gateway)) {
    throw new Error('gateway must be one of: perfectpay, hotmart, kiwify, stripe');
  }

  try {
    // 1. Create tenant
    const slug = generateSlug(req.companyName);
    const tenant = await prisma.tenant.create({
      data: {
        slug,
        name: req.companyName,
        status: 'active',
      },
    });

    // 2. Create funnel (optional if funnelName provided)
    let funnelId = '';
    if (req.funnelName) {
      const funnel = await prisma.funnel.create({
        data: {
          tenantId: tenant.id,
          name: req.funnelName,
          status: 'active',
        },
      });
      funnelId = funnel.id;
    }

    // 3. Generate webhook URL
    const webhookUrl = `https://api.track-ai.com/api/v1/webhooks/${req.gateway}/${tenant.id}`;

    // 4. Generate tracking pixel code
    const trackingPixelCode = generateTrackingPixelCode(tenant.id);

    return {
      success: true,
      tenantId: tenant.id,
      funnelId,
      tenantSlug: slug,
      webhookUrl,
      trackingPixelCode,
      message: `✅ Customer onboarded successfully. Deploy tracking pixel on ${req.funnelUrl || 'your site'}.`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes('Unique constraint failed')) {
      throw new Error(`Tenant with slug "${generateSlug(req.companyName)}" already exists`);
    }
    throw error;
  }
}
