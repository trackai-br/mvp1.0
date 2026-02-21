/**
 * KPI Cards — Home tab metrics display
 * Shows: total events, success %, match rate, latency p95, DLQ backlog, uptime
 */

import React from 'react';

interface KPICardsProps {
  metrics: any;
  isLoading: boolean;
  period: string;
}

export default function KPICards({ metrics, isLoading, period }: KPICardsProps) {
  const kpis = [
    {
      label: 'Total Events',
      value: metrics?.total_events || 0,
      unit: '',
      color: 'bg-blue-500',
      icon: '📊',
    },
    {
      label: 'Success Rate',
      value: metrics?.success_rate_pct || 0,
      unit: '%',
      color: 'bg-green-500',
      icon: '✅',
    },
    {
      label: 'Match Rate',
      value: metrics?.match_rate_pct || 0,
      unit: '%',
      color: 'bg-emerald-500',
      icon: '🎯',
    },
    {
      label: 'Latency p95',
      value: metrics?.latency_p95_ms || 0,
      unit: 'ms',
      color: 'bg-yellow-500',
      icon: '⚡',
    },
    {
      label: 'DLQ Backlog',
      value: metrics?.dlq_backlog || 0,
      unit: 'msgs',
      color: 'bg-red-500',
      icon: '⚠️',
    },
    {
      label: 'Uptime',
      value: metrics?.uptime_pct || 0,
      unit: '%',
      color: 'bg-purple-500',
      icon: '🟢',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {kpis.map((kpi, idx) => (
        <div
          key={idx}
          className="bg-slate-800 rounded-lg p-6 border border-slate-700 hover:border-slate-600 transition-colors"
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <p className="text-slate-400 text-sm font-medium">{kpi.label}</p>
              <div className="flex items-baseline gap-1 mt-2">
                <span className="text-3xl font-bold">
                  {isLoading ? '—' : kpi.value}
                </span>
                {kpi.unit && <span className="text-slate-400 text-sm">{kpi.unit}</span>}
              </div>
            </div>
            <span className="text-2xl">{kpi.icon}</span>
          </div>
          <div className="h-1 bg-slate-700 rounded-full overflow-hidden">
            <div
              className={`h-full ${kpi.color}`}
              style={{ width: `${Math.min(kpi.value, 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
