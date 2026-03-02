'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardBody, CardHeader } from '@nextui-org/card';
import { Spinner } from '@nextui-org/spinner';
import { Chip } from '@nextui-org/chip';

export interface FailureAnalysis {
  period: string;
  totalFailed: number;
  retryable: number;
  notRetryable: number;
  byErrorType: Record<string, number>;
  lastFailure: string | null;
}

export function FailureAnalysisCard({
  tenantId,
  periodDays = 30,
}: {
  tenantId: string;
  periodDays?: number;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', 'failure-analysis', tenantId, periodDays],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/admin/dispatch/failure-analysis?period=${periodDays}`,
        {
          headers: {
            'x-tenant-id': tenantId,
          },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch failure analysis');
      return res.json() as Promise<FailureAnalysis>;
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Análise de Falhas</h3>
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
          <h3 className="text-lg font-semibold">Análise de Falhas</h3>
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
          <h3 className="text-lg font-semibold">Análise de Falhas</h3>
        </CardHeader>
        <CardBody className="h-64 flex items-center justify-center">
          <p className="text-gray-500">Nenhum dado disponível</p>
        </CardBody>
      </Card>
    );
  }

  const retryablePercentage = data.totalFailed > 0 ? ((data.retryable / data.totalFailed) * 100).toFixed(0) : '0';

  const errorTypesSorted = Object.entries(data.byErrorType)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <Card>
      <CardHeader className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Análise de Falhas</h3>
        {data.totalFailed > 0 && data.totalFailed > 10 && (
          <Chip color="danger" variant="flat">
            ⚠️ {data.totalFailed} falhas
          </Chip>
        )}
      </CardHeader>
      <CardBody className="gap-4">
        {/* Main Stats Grid */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-red-50 p-3 rounded-lg border border-red-200">
            <p className="text-xs text-gray-600">❌ Total Falhas</p>
            <p className="text-2xl font-bold text-red-600">
              {data.totalFailed.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">conversões</p>
          </div>

          <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
            <p className="text-xs text-gray-600">🔄 Retentáveis</p>
            <p className="text-2xl font-bold text-orange-600">
              {data.retryable.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">{retryablePercentage}% das falhas</p>
          </div>

          <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
            <p className="text-xs text-gray-600">🚫 Permanentes</p>
            <p className="text-2xl font-bold text-gray-600">
              {data.notRetryable.toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">não serão retentadas</p>
          </div>
        </div>

        {/* Error Types Breakdown */}
        {errorTypesSorted.length > 0 && (
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm font-semibold text-gray-700 mb-3">Tipos de Erro (Top 5)</p>
            <div className="space-y-2">
              {errorTypesSorted.map(([errorType, count]) => {
                const percentage = ((count / data.totalFailed) * 100).toFixed(1);
                const color =
                  errorType === 'http_5xx'
                    ? 'bg-red-100'
                    : errorType === 'http_4xx'
                      ? 'bg-blue-100'
                      : errorType === 'timeout'
                        ? 'bg-yellow-100'
                        : 'bg-gray-100';

                const badgeColor =
                  errorType === 'http_5xx'
                    ? 'text-red-700'
                    : errorType === 'http_4xx'
                      ? 'text-blue-700'
                      : errorType === 'timeout'
                        ? 'text-yellow-700'
                        : 'text-gray-700';

                const icon =
                  errorType === 'http_5xx'
                    ? '🔥'
                    : errorType === 'http_4xx'
                      ? '❌'
                      : errorType === 'timeout'
                        ? '⏱️'
                        : '❓';

                return (
                  <div key={errorType} className={`${color} p-2 rounded flex justify-between items-center`}>
                    <span className={`text-sm font-medium ${badgeColor}`}>
                      {icon} {errorType}
                    </span>
                    <span className={`text-sm font-bold ${badgeColor}`}>
                      {count.toLocaleString()} ({percentage}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Last Failure Info */}
        {data.lastFailure && (
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p className="text-sm text-gray-700">
              <strong>Última falha:</strong>{' '}
              {new Date(data.lastFailure).toLocaleString('pt-BR')}
            </p>
          </div>
        )}

        {/* Empty State */}
        {data.totalFailed === 0 && (
          <div className="bg-green-50 p-3 rounded-lg border border-green-200 text-center">
            <p className="text-green-700 font-semibold">✅ Nenhuma falha detectada!</p>
            <p className="text-sm text-green-600">Todos os envios foram bem-sucedidos</p>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
