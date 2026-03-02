'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardBody, CardHeader } from '@nextui-org/card';
import { Spinner } from '@nextui-org/spinner';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

export interface MatchStrategy {
  strategy: string;
  count: number;
  percentage: number;
}

const COLORS = {
  fbp: '#10b981',
  fbc: '#3b82f6',
  email: '#f59e0b',
  phone: '#8b5cf6',
  unmatched: '#ef4444',
};

export function MatchRateCard({
  tenantId,
  periodDays = 30,
}: {
  tenantId: string;
  periodDays?: number;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', 'match-rate', tenantId, periodDays],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/analytics/match-rate?period=${periodDays}`,
        {
          headers: {
            'x-tenant-id': tenantId,
          },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch match rate');
      return res.json() as Promise<MatchStrategy[]>;
    },
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Estratégias de Match</h3>
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
          <h3 className="text-lg font-semibold">Estratégias de Match</h3>
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
          <h3 className="text-lg font-semibold">Estratégias de Match</h3>
        </CardHeader>
        <CardBody className="h-96 flex items-center justify-center">
          <p className="text-gray-500">Nenhum dado disponível</p>
        </CardBody>
      </Card>
    );
  }

  const chartData = data.map((d) => ({
    name: d.strategy === 'unmatched' ? 'Sem Match' : d.strategy.toUpperCase(),
    value: d.count,
    percentage: d.percentage,
  }));

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Estratégias de Match</h3>
      </CardHeader>
      <CardBody>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, value }) => {
                const total = chartData.reduce((sum, item) => sum + item.value, 0);
                const pct = ((value / total) * 100).toFixed(1);
                return `${name} (${pct}%)`;
              }}
              outerRadius={100}
              fill="#8884d8"
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={
                    COLORS[entry.name.toLowerCase() as keyof typeof COLORS] ||
                    '#888'
                  }
                />
              ))}
            </Pie>
            <Tooltip formatter={(value: number | undefined) => typeof value === 'number' ? value.toLocaleString() : value} />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {data.map((strategy, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 text-sm"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{
                  backgroundColor:
                    COLORS[strategy.strategy as keyof typeof COLORS] ||
                    '#888',
                }}
              />
              <span className="text-gray-700">
                {strategy.strategy === 'unmatched'
                  ? 'Sem Match'
                  : strategy.strategy.toUpperCase()}
                : {strategy.count} ({strategy.percentage.toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
