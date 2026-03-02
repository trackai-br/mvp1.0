'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardBody, CardHeader } from '@nextui-org/card';
import { Spinner } from '@nextui-org/spinner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

export interface ConversionMetric {
  date: string;
  conversions: number;
  revenue: number;
  sentToCAPI: number;
  matchedCount: number;
}

export function ConversionsChart({
  tenantId,
  periodDays = 30,
}: {
  tenantId: string;
  periodDays?: number;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', 'conversions', tenantId, periodDays],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/analytics/conversions/timeseries?period=${periodDays}`,
        {
          headers: {
            'x-tenant-id': tenantId,
          },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch conversions');
      return res.json() as Promise<ConversionMetric[]>;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex justify-between items-center">
          <h3 className="text-lg font-semibold">Conversões ao Longo do Tempo</h3>
        </CardHeader>
        <CardBody className="flex justify-center items-center h-96">
          <Spinner label="Carregando gráfico..." />
        </CardBody>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Conversões ao Longo do Tempo</h3>
        </CardHeader>
        <CardBody className="bg-red-50 p-4 rounded border border-red-200">
          <p className="text-red-800">Erro ao carregar gráfico</p>
        </CardBody>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Conversões ao Longo do Tempo</h3>
        </CardHeader>
        <CardBody className="h-96 flex items-center justify-center">
          <p className="text-gray-500">Nenhum dado disponível</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex justify-between items-center">
        <h3 className="text-lg font-semibold">Conversões ao Longo do Tempo</h3>
        <span className="text-sm text-gray-600">{data.length} dias</span>
      </CardHeader>
      <CardBody>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12 }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #ccc',
                borderRadius: '4px',
              }}
              formatter={(value: number | undefined) => typeof value === 'number' ? value.toLocaleString() : value}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="conversions"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name="Conversões"
            />
            <Line
              type="monotone"
              dataKey="sentToCAPI"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              name="Enviadas para Meta"
            />
            <Line
              type="monotone"
              dataKey="matchedCount"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
              name="Matched"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardBody>
    </Card>
  );
}
