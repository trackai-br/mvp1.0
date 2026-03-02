import { prisma } from '../db.js';

/**
 * Analytics Service
 * Provides aggregated metrics for dashboard
 * Supports date range and gateway filters
 */

export interface AnalyticsPeriod {
  startDate: Date;
  endDate: Date;
}

export interface DashboardSummary {
  period: AnalyticsPeriod;
  metrics: {
    totalClicks: number;
    totalConversions: number;
    conversionRate: number; // %
    totalRevenue: number;
    matchRate: number; // %
    sentToCAPI: number;
    failedDispatch: number;
    dispatchSuccessRate: number; // %
  };
  breakdown: {
    byGateway: Array<{
      gateway: string;
      clicks: number;
      conversions: number;
      revenue: number;
      conversionRate: number;
    }>;
    byMatchStrategy: Array<{
      strategy: string;
      count: number;
      percentage: number;
    }>;
  };
}

export interface ConversionMetrics {
  date: string; // YYYY-MM-DD
  conversions: number;
  revenue: number;
  sentToCAPI: number;
  matchedCount: number;
}

export interface DispatchMetrics {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  successRate: number; // %
  averageAttemptsPerConversion: number;
}

/**
 * Get dashboard summary with all key metrics
 */
export async function getDashboardSummary(
  tenantId: string,
  periodDays: number = 30,
  gateway?: string
): Promise<DashboardSummary> {
  const now = new Date();
  const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // Build filters
  const clickWhere = {
    tenantId,
    createdAt: { gte: startDate, lte: now },
    ...(gateway && { gateway: gateway as any }),
  };

  const conversionWhere = {
    tenantId,
    createdAt: { gte: startDate, lte: now },
    ...(gateway && { gateway: gateway as any }),
  };

  // Query clicks
  const totalClicks = await prisma.click.count({
    where: clickWhere,
  });

  // Query conversions
  const totalConversions = await prisma.conversion.count({
    where: conversionWhere,
  });

  // Query revenue (SUM amount)
  const revenueResult = await prisma.conversion.aggregate({
    where: conversionWhere,
    _sum: { amount: true },
  });
  const totalRevenue = revenueResult._sum.amount || 0;

  // Query conversions sent to CAPI
  const sentToCAPI = await prisma.conversion.count({
    where: { ...conversionWhere, sentToCAPI: true },
  });

  // Query failed dispatches
  const failedDispatches = await prisma.conversion.count({
    where: { ...conversionWhere, sentToCAPI: false },
  });

  // Query matched conversions
  const matchedConversions = await prisma.conversion.count({
    where: { ...conversionWhere, matchedClickId: { not: null } },
  });

  // Calculate rates
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
  const matchRate = totalConversions > 0 ? (matchedConversions / totalConversions) * 100 : 0;
  const dispatchSuccessRate =
    totalConversions > 0 ? (sentToCAPI / totalConversions) * 100 : 0;

  // Query breakdown by gateway
  const byGateway = await prisma.conversion.groupBy({
    by: ['gateway'],
    where: conversionWhere,
    _count: { _all: true },
    _sum: { amount: true },
  });

  const gatewayBreakdown = byGateway.map((group) => {
    const conversionsCount = group._count._all;
    const gatewayClicks = totalClicks; // Approximate - clicks don't have gateway field

    return {
      gateway: String(group.gateway),
      clicks: gatewayClicks,
      conversions: conversionsCount,
      revenue: group._sum.amount || 0,
      conversionRate: gatewayClicks > 0 ? (conversionsCount / gatewayClicks) * 100 : 0,
    };
  });

  // Query breakdown by match strategy
  const byMatchStrategy = await prisma.conversion.groupBy({
    by: ['matchStrategy'],
    where: conversionWhere,
    _count: { _all: true },
  });

  const strategyBreakdown = byMatchStrategy.map((group) => ({
    strategy: String(group.matchStrategy || 'unmatched'),
    count: group._count._all,
    percentage:
      totalConversions > 0 ? (group._count._all / totalConversions) * 100 : 0,
  }));

  return {
    period: { startDate, endDate: now },
    metrics: {
      totalClicks,
      totalConversions,
      conversionRate: Math.round(conversionRate * 100) / 100,
      totalRevenue,
      matchRate: Math.round(matchRate * 100) / 100,
      sentToCAPI,
      failedDispatch: failedDispatches,
      dispatchSuccessRate: Math.round(dispatchSuccessRate * 100) / 100,
    },
    breakdown: {
      byGateway: gatewayBreakdown,
      byMatchStrategy: strategyBreakdown,
    },
  };
}

/**
 * Get daily conversion metrics for time series chart
 */
export async function getConversionTimeseries(
  tenantId: string,
  periodDays: number = 30,
  gateway?: string
): Promise<ConversionMetrics[]> {
  const now = new Date();
  const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const conversions = await prisma.conversion.findMany({
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: now },
      ...(gateway && { gateway: gateway as any }),
    },
    select: {
      createdAt: true,
      amount: true,
      sentToCAPI: true,
      matchedClickId: true,
    },
  });

  // Group by date
  const byDate = new Map<string, ConversionMetrics>();

  for (const conv of conversions) {
    const date = conv.createdAt.toISOString().split('T')[0]; // YYYY-MM-DD

    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        conversions: 0,
        revenue: 0,
        sentToCAPI: 0,
        matchedCount: 0,
      });
    }

    const metrics = byDate.get(date)!;
    metrics.conversions += 1;
    metrics.revenue += conv.amount || 0;
    if (conv.sentToCAPI) metrics.sentToCAPI += 1;
    if (conv.matchedClickId) metrics.matchedCount += 1;
  }

  // Sort by date
  return Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}

/**
 * Get dispatch metrics (Meta CAPI success/failure)
 */
export async function getDispatchMetrics(
  tenantId: string,
  periodDays: number = 30
): Promise<DispatchMetrics> {
  const now = new Date();
  const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  // Get all dispatch attempts
  const attempts = await prisma.dispatchAttempt.findMany({
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: now },
    },
    select: {
      status: true,
      attempt: true,
    },
  });

  if (attempts.length === 0) {
    return {
      totalAttempts: 0,
      successCount: 0,
      failureCount: 0,
      successRate: 0,
      averageAttemptsPerConversion: 0,
    };
  }

  // Count by status
  const successCount = attempts.filter((a) => a.status === 'success').length;
  const failureCount = attempts.filter((a) => a.status === 'failed').length;

  // Get unique conversions (by eventId max attempt)
  const conversions = await prisma.conversion.findMany({
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: now },
    },
    select: { id: true },
  });

  const uniqueConversions = conversions.length;
  const averageAttempts =
    uniqueConversions > 0 ? attempts.length / uniqueConversions : 0;

  return {
    totalAttempts: attempts.length,
    successCount,
    failureCount,
    successRate: Math.round((successCount / attempts.length) * 100 * 100) / 100,
    averageAttemptsPerConversion: Math.round(averageAttempts * 100) / 100,
  };
}

/**
 * Get match rate breakdown by strategy
 */
export async function getMatchRateBreakdown(
  tenantId: string,
  periodDays: number = 30
): Promise<
  Array<{ strategy: string; count: number; percentage: number }>
> {
  const now = new Date();
  const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const conversions = await prisma.conversion.groupBy({
    by: ['matchStrategy'],
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: now },
    },
    _count: { _all: true },
  });

  const total = conversions.reduce((sum, c) => sum + c._count._all, 0);

  return conversions.map((c) => ({
    strategy: String(c.matchStrategy || 'unmatched'),
    count: c._count._all,
    percentage: total > 0 ? Math.round((c._count._all / total) * 100 * 100) / 100 : 0,
  }));
}

/**
 * Get top gateways by conversion count
 */
export async function getTopGateways(
  tenantId: string,
  periodDays: number = 30,
  limit: number = 5
): Promise<
  Array<{ gateway: string; conversions: number; revenue: number; percentage: number }>
> {
  const now = new Date();
  const startDate = new Date(now.getTime() - periodDays * 24 * 60 * 60 * 1000);

  const gateways = await prisma.conversion.groupBy({
    by: ['gateway'],
    where: {
      tenantId,
      createdAt: { gte: startDate, lte: now },
    },
    _count: { _all: true },
    _sum: { amount: true },
  });

  const total = gateways.reduce((sum, g) => sum + g._count._all, 0);

  return gateways
    .map((g) => ({
      gateway: String(g.gateway),
      conversions: g._count._all,
      revenue: g._sum.amount || 0,
      percentage: total > 0 ? Math.round((g._count._all / total) * 100 * 100) / 100 : 0,
    }))
    .sort((a, b) => b.conversions - a.conversions)
    .slice(0, limit);
}

/**
 * Get recent conversions for table display
 */
export async function getRecentConversions(
  tenantId: string,
  limit: number = 10
): Promise<
  Array<{
    id: string;
    gateway: string;
    amount: number | null;
    currency: string;
    matchedClickId: string | null;
    sentToCAPI: boolean;
    createdAt: Date;
  }>
> {
  return prisma.conversion.findMany({
    where: { tenantId },
    select: {
      id: true,
      gateway: true,
      amount: true,
      currency: true,
      matchedClickId: true,
      sentToCAPI: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}
