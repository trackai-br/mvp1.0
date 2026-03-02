'use client';

import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@nextui-org/spinner';
import { Card, CardBody } from '@nextui-org/card';

export interface DashboardSummary {
  period: {
    startDate: string;
    endDate: string;
  };
  metrics: {
    totalClicks: number;
    totalConversions: number;
    conversionRate: number;
    totalRevenue: number;
    matchRate: number;
    sentToCAPI: number;
    failedDispatch: number;
    dispatchSuccessRate: number;
  };
}

export function DashboardOverview({ tenantId, periodDays = 30 }: { tenantId: string; periodDays?: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', 'summary', tenantId, periodDays],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/analytics/summary?period=${periodDays}`,
        {
          headers: {
            'x-tenant-id': tenantId,
          },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch summary');
      return res.json() as Promise<DashboardSummary>;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner label="Carregando métricas..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 p-4 rounded-lg border border-red-200">
        <p className="text-red-800">Erro ao carregar métricas</p>
      </div>
    );
  }

  if (!data) return null;

  const { metrics } = data;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* Total Clicks */}
      <Card className="bg-gradient-to-br from-blue-50 to-blue-100">
        <CardBody className="gap-2">
          <p className="text-sm text-gray-600">📊 Total Clicks</p>
          <p className="text-3xl font-bold text-blue-700">{metrics.totalClicks.toLocaleString()}</p>
          <p className="text-xs text-gray-500">Últimos {periodDays} dias</p>
        </CardBody>
      </Card>

      {/* Total Conversions */}
      <Card className="bg-gradient-to-br from-green-50 to-green-100">
        <CardBody className="gap-2">
          <p className="text-sm text-gray-600">🎯 Conversions</p>
          <p className="text-3xl font-bold text-green-700">{metrics.totalConversions.toLocaleString()}</p>
          <p className="text-xs text-green-600">
            {metrics.conversionRate.toFixed(1)}% de taxa
          </p>
        </CardBody>
      </Card>

      {/* Total Revenue */}
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100">
        <CardBody className="gap-2">
          <p className="text-sm text-gray-600">💰 Receita Total</p>
          <p className="text-3xl font-bold text-purple-700">
            R$ {metrics.totalRevenue.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}
          </p>
          <p className="text-xs text-gray-500">Rastreado com sucesso</p>
        </CardBody>
      </Card>

      {/* Match Rate */}
      <Card className="bg-gradient-to-br from-orange-50 to-orange-100">
        <CardBody className="gap-2">
          <p className="text-sm text-gray-600">📈 Match Rate</p>
          <p className="text-3xl font-bold text-orange-700">{metrics.matchRate.toFixed(1)}%</p>
          <p className="text-xs text-orange-600">
            {metrics.totalConversions > 0
              ? Math.round((metrics.totalConversions * metrics.matchRate) / 100)
              : 0}{' '}
            matched
          </p>
        </CardBody>
      </Card>

      {/* Sent to Meta */}
      <Card className="bg-gradient-to-br from-cyan-50 to-cyan-100">
        <CardBody className="gap-2">
          <p className="text-sm text-gray-600">✅ Sent to Meta</p>
          <p className="text-3xl font-bold text-cyan-700">{metrics.sentToCAPI.toLocaleString()}</p>
          <p className="text-xs text-cyan-600">
            {metrics.totalConversions > 0
              ? Math.round((metrics.sentToCAPI / metrics.totalConversions) * 100)
              : 0}
            % sucesso
          </p>
        </CardBody>
      </Card>

      {/* Failed Dispatches */}
      <Card className="bg-gradient-to-br from-red-50 to-red-100">
        <CardBody className="gap-2">
          <p className="text-sm text-gray-600">⚠️ Failed</p>
          <p className="text-3xl font-bold text-red-700">{metrics.failedDispatch.toLocaleString()}</p>
          <p className="text-xs text-red-600">
            {metrics.totalConversions > 0
              ? Math.round((metrics.failedDispatch / metrics.totalConversions) * 100)
              : 0}
            % falhado
          </p>
        </CardBody>
      </Card>

      {/* Dispatch Success Rate */}
      <Card className="bg-gradient-to-br from-indigo-50 to-indigo-100">
        <CardBody className="gap-2">
          <p className="text-sm text-gray-600">📊 CAPI Success</p>
          <p className="text-3xl font-bold text-indigo-700">
            {metrics.dispatchSuccessRate.toFixed(1)}%
          </p>
          <p className="text-xs text-indigo-600">Taxa de sucesso Meta</p>
        </CardBody>
      </Card>

      {/* Period Info */}
      <Card className="bg-gradient-to-br from-gray-50 to-gray-100">
        <CardBody className="gap-2">
          <p className="text-sm text-gray-600">📅 Período</p>
          <p className="text-lg font-semibold text-gray-700">
            {periodDays === 7 ? '7 dias' : periodDays === 30 ? '30 dias' : `${periodDays} dias`}
          </p>
          <p className="text-xs text-gray-500">
            Atualizado a cada 30s
          </p>
        </CardBody>
      </Card>
    </div>
  );
}
