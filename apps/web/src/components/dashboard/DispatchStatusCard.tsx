'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardBody, CardHeader } from '@nextui-org/card';
import { Spinner } from '@nextui-org/spinner';
import { Progress } from '@nextui-org/progress';

export interface DispatchMetrics {
  totalAttempts: number;
  successCount: number;
  failureCount: number;
  successRate: number;
  averageAttemptsPerConversion: number;
}

export function DispatchStatusCard({
  tenantId,
  periodDays = 30,
}: {
  tenantId: string;
  periodDays?: number;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', 'dispatch', tenantId, periodDays],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/analytics/dispatch?period=${periodDays}`,
        {
          headers: {
            'x-tenant-id': tenantId,
          },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch dispatch metrics');
      return res.json() as Promise<DispatchMetrics>;
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Status de Envio Meta CAPI</h3>
        </CardHeader>
        <CardBody className="flex justify-center items-center h-64">
          <Spinner label="Carregando..." />
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Status de Envio Meta CAPI</h3>
        </CardHeader>
        <CardBody className="bg-red-50 p-4 rounded border border-red-200">
          <p className="text-red-800">Erro ao carregar dados</p>
        </CardBody>
      </Card>
    );
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Status de Envio Meta CAPI</h3>
        </CardHeader>
        <CardBody className="h-64 flex items-center justify-center">
          <p className="text-gray-500">Nenhum dado disponível</p>
        </CardBody>
      </Card>
    );
  }

  const successPercentage = data.successRate;

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Status de Envio Meta CAPI</h3>
      </CardHeader>
      <CardBody className="gap-4">
        {/* Main Progress */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-semibold text-gray-700">
              Taxa de Sucesso
            </span>
            <span className="text-2xl font-bold text-green-600">
              {successPercentage.toFixed(1)}%
            </span>
          </div>
          <Progress
            value={successPercentage}
            className="w-full"
            color={
              successPercentage >= 95
                ? 'success'
                : successPercentage >= 80
                  ? 'warning'
                  : 'danger'
            }
          />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600">✅ Sucesso</p>
            <p className="text-2xl font-bold text-green-600">
              {data.successCount.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">tentativas</p>
          </div>

          <div className="bg-red-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600">❌ Falha</p>
            <p className="text-2xl font-bold text-red-600">
              {data.failureCount.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">tentativas</p>
          </div>

          <div className="bg-blue-50 p-3 rounded-lg">
            <p className="text-xs text-gray-600">📊 Total</p>
            <p className="text-2xl font-bold text-blue-600">
              {data.totalAttempts.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">tentativas</p>
          </div>
        </div>

        {/* Average Attempts */}
        <div className="bg-gray-50 p-3 rounded-lg">
          <p className="text-sm text-gray-700">
            <strong>Média de tentativas:</strong> {data.averageAttemptsPerConversion.toFixed(2)} por conversão
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {data.averageAttemptsPerConversion > 1.5
              ? '⚠️ Alto número de retentativas'
              : data.averageAttemptsPerConversion > 1.1
                ? '⚡ Algumas retentativas necessárias'
                : '✅ Enviando na primeira tentativa'}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
