/**
 * Dashboard Page — Story 010: Dashboard Operacional + Analytics
 *
 * Operational dashboard with 6 tabs:
 * - Home: KPIs (total events, success %, match rate, latency, DLQ, uptime)
 * - Events: Filterable event log with detail modal
 * - Failures: DLQ monitor + circuit breaker status
 * - Match Rate: Line chart + by gateway breakdown
 * - Performance: Latency percentiles + throughput
 * - Export: CSV/JSON download
 */

'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';

// Components
import KPICards from '@/components/dashboard/kpi-cards';
import EventsTable from '@/components/dashboard/events-table';
import FailuresMonitor from '@/components/dashboard/failures-monitor';
import MatchRateChart from '@/components/dashboard/match-rate-chart';
import PerformanceChart from '@/components/dashboard/performance-chart';
import ExportPanel from '@/components/dashboard/export-panel';

type Tab = 'home' | 'events' | 'failures' | 'match-rate' | 'performance' | 'export';
type Period = '24h' | '7d' | '30d';

const TAB_LABELS: Record<Tab, string> = {
  home: '📊 Home',
  events: '📋 Events',
  failures: '⚠️ Failures',
  'match-rate': '📈 Match Rate',
  performance: '⚡ Performance',
  export: '💾 Export',
};

export default function DashboardPage() {
  const [activeTab, setActiveTab] = useState<Tab>('home');
  const [period, setPeriod] = useState<Period>('7d');
  const [timezone, setTimezone] = useState('local');

  // Fetch metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['analytics', 'metrics', period],
    queryFn: async () => {
      const res = await fetch(`/api/v1/analytics/metrics?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch metrics');
      return res.json();
    },
    refetchInterval: 30000, // Refresh every 30s
  });

  // Fetch events
  const { data: events, isLoading: eventsLoading } = useQuery({
    queryKey: ['analytics', 'events', period],
    queryFn: async () => {
      const res = await fetch(`/api/v1/analytics/events?period=${period}&page=1&limit=50`);
      if (!res.ok) throw new Error('Failed to fetch events');
      return res.json();
    },
  });

  // Fetch performance data
  const { data: performance, isLoading: performanceLoading } = useQuery({
    queryKey: ['analytics', 'performance', period],
    queryFn: async () => {
      const res = await fetch(`/api/v1/analytics/performance?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch performance');
      return res.json();
    },
  });

  // Fetch match rate
  const { data: matchRate, isLoading: matchRateLoading } = useQuery({
    queryKey: ['analytics', 'match-rate', period],
    queryFn: async () => {
      const res = await fetch(`/api/v1/analytics/match-rate?period=${period}`);
      if (!res.ok) throw new Error('Failed to fetch match rate');
      return res.json();
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 text-white">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold">Dashboard Operacional</h1>
              <p className="text-slate-400 text-sm mt-1">Track AI SQS Dispatch Analytics</p>
            </div>
            <div className="flex gap-4">
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as Period)}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-sm"
              >
                <option value="24h">Last 24h</option>
                <option value="7d">Last 7d</option>
                <option value="30d">Last 30d</option>
              </select>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 border border-slate-600 text-sm"
              >
                <option value="local">Local TZ</option>
                <option value="utc">UTC</option>
              </select>
              <button className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs font-medium">
                🌙 Dark Mode
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="flex gap-2 overflow-x-auto">
            {(Object.entries(TAB_LABELS) as [Tab, string][]).map(([tab, label]) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 rounded-t-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Home Tab */}
        {activeTab === 'home' && (
          <div className="space-y-8">
            <KPICards
              metrics={metrics}
              isLoading={metricsLoading}
            />

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Latency Trend */}
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold mb-4">Latency Trend (7d)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={performance?.data || []}>
                    <defs>
                      <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Area
                      type="monotone"
                      dataKey="latency_p95"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorLatency)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Match Rate Trend */}
              <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
                <h3 className="text-lg font-semibold mb-4">Match Rate Trend (30d)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={matchRate?.data || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis dataKey="date" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="match_rate_pct"
                      stroke="#10b981"
                      name="Match Rate %"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Events Tab */}
        {activeTab === 'events' && (
          <EventsTable
            events={events?.data || []}
            isLoading={eventsLoading}
            pagination={events?.pagination}
          />
        )}

        {/* Failures Tab */}
        {activeTab === 'failures' && (
          <FailuresMonitor
            metrics={metrics}
            isLoading={metricsLoading}
          />
        )}

        {/* Match Rate Tab */}
        {activeTab === 'match-rate' && (
          <MatchRateChart
            data={matchRate}
            isLoading={matchRateLoading}
            period={period}
          />
        )}

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <PerformanceChart
            data={performance}
            isLoading={performanceLoading}
            period={period}
          />
        )}

        {/* Export Tab */}
        {activeTab === 'export' && (
          <ExportPanel
            period={period}
            onPeriodChange={setPeriod}
          />
        )}
      </main>
    </div>
  );
}
