/**
 * Performance Chart — Latency percentiles + throughput
 */

import React, { useState } from 'react';
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface PerformanceChartProps {
  data: any;
  isLoading: boolean;
  period: string;
}

export default function PerformanceChart({ data, isLoading, period }: PerformanceChartProps) {
  const [metric, setMetric] = useState<'latency' | 'throughput'>('latency');

  if (isLoading) return <div className="text-center py-12">Loading performance data...</div>;

  return (
    <div className="space-y-6">
      {/* Metric Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setMetric('latency')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            metric === 'latency'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Latency Percentiles
        </button>
        <button
          onClick={() => setMetric('throughput')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            metric === 'throughput'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Throughput
        </button>
      </div>

      {/* Latency Chart */}
      {metric === 'latency' && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Latency Percentiles ({period})</h3>
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart data={data?.data || []}>
              <defs>
                <linearGradient id="colorP50" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorP95" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorP99" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" label={{ value: 'Latency (ms)', angle: -90, position: 'insideLeft' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Legend />
              <Area
                type="monotone"
                dataKey="latency_p50"
                stroke="#60a5fa"
                fillOpacity={1}
                fill="url(#colorP50)"
                name="P50"
              />
              <Area
                type="monotone"
                dataKey="latency_p95"
                stroke="#fbbf24"
                fillOpacity={1}
                fill="url(#colorP95)"
                name="P95"
              />
              <Area
                type="monotone"
                dataKey="latency_p99"
                stroke="#ef4444"
                fillOpacity={1}
                fill="url(#colorP99)"
                name="P99"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Throughput Chart */}
      {metric === 'throughput' && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Daily Throughput ({period})</h3>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={data?.data || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" label={{ value: 'Events/sec', angle: -90, position: 'insideLeft' }} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Legend />
              <Line
                type="monotone"
                dataKey="throughput_eps"
                stroke="#10b981"
                name="Events/sec"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Avg P50</p>
          <p className="text-2xl font-bold text-blue-400 mt-2">
            {data?.summary?.avg_p50_ms || 0}ms
          </p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Avg P95</p>
          <p className="text-2xl font-bold text-yellow-400 mt-2">
            {data?.summary?.avg_p95_ms || 0}ms
          </p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Avg P99</p>
          <p className="text-2xl font-bold text-red-400 mt-2">
            {data?.summary?.avg_p99_ms || 0}ms
          </p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Avg Throughput</p>
          <p className="text-2xl font-bold text-green-400 mt-2">
            {data?.summary?.avg_throughput_eps || 0}
          </p>
          <p className="text-xs text-slate-400 mt-1">events/sec</p>
        </div>
      </div>
    </div>
  );
}
