/**
 * Dashboard Page — Story 010: Dashboard de Conversões + Analytics
 *
 * Dashboard com visualizações em tempo real:
 * - KPIs: Cliques, conversões, receita, match rate, sucesso CAPI
 * - Gráfico de conversões ao longo do tempo (3 métricas)
 * - Distribuição por gateway (conversões e receita)
 * - Taxa de sucesso de envio Meta CAPI
 * - Estratégias de match (FBP, FBC, Email, Phone)
 * - Tabela de conversões recentes
 */

'use client';

import { useState, useEffect } from 'react';
import { DashboardOverview } from '@/components/dashboard/DashboardOverview';
import { ConversionsChart } from '@/components/dashboard/ConversionsChart';
import { GatewayDistribution } from '@/components/dashboard/GatewayDistribution';
import { DispatchStatusCard } from '@/components/dashboard/DispatchStatusCard';
import { MatchRateCard } from '@/components/dashboard/MatchRateCard';
import { RecentConversionsTable } from '@/components/dashboard/RecentConversionsTable';

type Period = 7 | 30 | 90;

export default function DashboardPage() {
  const [tenantId, setTenantId] = useState<string>('');
  const [period, setPeriod] = useState<Period>(30);

  // Get tenant ID from URL params or context
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tid = params.get('tenantId') || localStorage.getItem('tenantId') || 'demo-tenant';
    setTenantId(tid);
  }, []);

  if (!tenantId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Dashboard de Conversões</h1>
              <p className="text-gray-600 text-sm mt-1">Rastreamento em tempo real do hub server-side</p>
            </div>
            <div className="flex gap-3">
              <select
                value={period}
                onChange={(e) => setPeriod(Number(e.target.value) as Period)}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium hover:border-gray-400"
              >
                <option value={7}>Últimos 7 dias</option>
                <option value={30}>Últimos 30 dias</option>
                <option value={90}>Últimos 90 dias</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* KPI Cards */}
          <DashboardOverview tenantId={tenantId} periodDays={period} />

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Conversions Timeline */}
            <ConversionsChart tenantId={tenantId} periodDays={period} />

            {/* Gateway Distribution */}
            <GatewayDistribution tenantId={tenantId} periodDays={period} />
          </div>

          {/* Dispatch and Match Rate */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dispatch Status */}
            <DispatchStatusCard tenantId={tenantId} periodDays={period} />

            {/* Match Rate Card */}
            <MatchRateCard tenantId={tenantId} periodDays={period} />
          </div>

          {/* Recent Conversions Table */}
          <RecentConversionsTable tenantId={tenantId} limit={10} />
        </div>
      </main>
    </div>
  );
}
