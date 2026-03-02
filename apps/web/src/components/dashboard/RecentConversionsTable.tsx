'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardBody, CardHeader } from '@nextui-org/card';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@nextui-org/table';
import { Spinner } from '@nextui-org/spinner';
import { Chip } from '@nextui-org/chip';

export interface ConversionRecord {
  id: string;
  gateway: string;
  amount: number | null;
  currency: string;
  matchedClickId: string | null;
  sentToCAPI: boolean;
  createdAt: string;
}

export function RecentConversionsTable({ tenantId, limit = 10 }: { tenantId: string; limit?: number }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics', 'conversions', 'recent', tenantId, limit],
    queryFn: async () => {
      const res = await fetch(
        `/api/v1/analytics/conversions/recent?limit=${limit}`,
        {
          headers: {
            'x-tenant-id': tenantId,
          },
        }
      );
      if (!res.ok) throw new Error('Failed to fetch recent conversions');
      return res.json() as Promise<ConversionRecord[]>;
    },
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold">Conversões Recentes</h3>
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
          <h3 className="text-lg font-semibold">Conversões Recentes</h3>
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
          <h3 className="text-lg font-semibold">Conversões Recentes</h3>
        </CardHeader>
        <CardBody className="h-64 flex items-center justify-center">
          <p className="text-gray-500">Nenhuma conversão encontrada</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <h3 className="text-lg font-semibold">Conversões Recentes</h3>
      </CardHeader>
      <CardBody>
        <Table aria-label="Recent conversions table">
          <TableHeader>
            <TableColumn>Gateway</TableColumn>
            <TableColumn>Valor</TableColumn>
            <TableColumn>Status Match</TableColumn>
            <TableColumn>Sent to CAPI</TableColumn>
            <TableColumn>Data</TableColumn>
          </TableHeader>
          <TableBody>
            {data.map((conversion) => (
              <TableRow key={conversion.id}>
                <TableCell>
                  <span className="font-semibold capitalize">{conversion.gateway}</span>
                </TableCell>
                <TableCell>
                  {conversion.amount
                    ? `R$ ${conversion.amount.toLocaleString('pt-BR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    : '-'}
                </TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={conversion.matchedClickId ? 'success' : 'warning'}
                    className="capitalize"
                  >
                    {conversion.matchedClickId ? '✓ Matched' : '✗ Unmatched'}
                  </Chip>
                </TableCell>
                <TableCell>
                  <Chip
                    size="sm"
                    variant="flat"
                    color={conversion.sentToCAPI ? 'success' : 'danger'}
                    className="capitalize"
                  >
                    {conversion.sentToCAPI ? '✓ Enviado' : '✗ Pendente'}
                  </Chip>
                </TableCell>
                <TableCell className="text-xs text-gray-600">
                  {new Date(conversion.createdAt).toLocaleString('pt-BR')}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  );
}
