'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardBody, CardHeader } from '@nextui-org/card';
import { Spinner } from '@nextui-org/spinner';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface GatewayMetric {
  gateway: string;
  conversions: number;
  revenue: number;
  percentage: number;
}

const COLORS = {
  hotmart: '#ef4444',
  kiwify: '#f59e0b',
  stripe: '#3b82f6',
  pagseguro: '#8b5cf6',
  perfectpay: '#10b981',
};

export function GatewayDistribution({
  tenantId,
  periodDays = 30,
}: {
  tenantId: string;
  periodDays?: number;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', 'gateways', tenantId, periodDays],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/analytics/gateways/top?period=${periodDays}&limit=10`,
        {
          headers: {
            'x-tenant-id': tenantId,
          },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch gateways');
      return res.json() as Promise<GatewayMetric[]>;
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Distribuição por Gateway</h3>
        </CardHeader>
        <CardBody className="flex justify-center items-center h-96">
          <Spinner label="Carregando..." />
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Distribuição por Gateway</h3>
        </CardHeader>
        <CardBody className="bg-red-50 p-4 rounded border border-red-200">
          <p className="text-red-800">Erro ao carregar dados</p>
        </CardBody>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Distribuição por Gateway</h3>
        </CardHeader>
        <CardBody className="h-96 flex items-center justify-center">
          <p className="text-gray-500">Nenhum dado disponível</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Distribuição por Gateway</h3>
      </CardHeader>
      <CardBody>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="gateway" tick={{ fontSize: 12 }} />
            <YAxis />
            <Tooltip formatter={(value: number | undefined) => typeof value === 'number' ? value.toLocaleString() : value} />
            <Legend />
            <Bar
              dataKey="conversions"
              fill="#3b82f6"
              name="Conversões"
              radius={[8, 8, 0, 0]}
            />
            <Bar
              dataKey="revenue"
              fill="#10b981"
              name="Receita (R$)"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>

        {/* Gateway Legend */}
        <div className="mt-4 space-y-2">
          {data.map((gateway, idx) => (
            <div
              key={idx}
              className="flex items-center justify-between p-2 bg-gray-50 rounded"
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{
                    backgroundColor:
                      COLORS[gateway.gateway as keyof typeof COLORS] ||
                      '#888',
                  }}
                />
                <span className="font-semibold text-gray-700 capitalize">
                  {gateway.gateway}
                </span>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-700">
                  {gateway.conversions} conversões
                </p>
                <p className="text-xs text-gray-500">
                  R$ {gateway.revenue.toLocaleString('pt-BR', {
                    maximumFractionDigits: 0,
                  })} ({gateway.percentage.toFixed(1)}%)
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
