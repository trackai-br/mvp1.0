/**
 * Match Rate Chart — Daily trend + by-gateway breakdown
 */

import React, { useState } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

interface MatchRateChartProps {
  data: any;
  isLoading: boolean;
  period: string;
}

export default function MatchRateChart({ data, isLoading, period }: MatchRateChartProps) {
  const [view, setView] = useState<'trend' | 'breakdown'>('trend');

  if (isLoading) return <div className="text-center py-12">Loading match rate data...</div>;

  return (
    <div className="space-y-6">
      {/* View Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('trend')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'trend'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          Trend
        </button>
        <button
          onClick={() => setView('breakdown')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            view === 'breakdown'
              ? 'bg-blue-600 text-white'
              : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
          }`}
        >
          By Gateway
        </button>
      </div>

      {/* Trend View */}
      {view === 'trend' && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Match Rate Trend ({period})</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data?.data || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="date" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Legend />
              <Line
                type="monotone"
                dataKey="match_rate_pct"
                stroke="#10b981"
                name="Match Rate %"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Breakdown View */}
      {view === 'breakdown' && (
        <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
          <h3 className="text-lg font-semibold mb-4">Match Rate by Gateway</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data?.by_gateway || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
              <XAxis dataKey="gateway" stroke="#94a3b8" />
              <YAxis stroke="#94a3b8" domain={[0, 100]} />
              <Tooltip contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #475569' }} />
              <Legend />
              <Bar dataKey="match_rate_pct" fill="#10b981" name="Match Rate %" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Average Match Rate</p>
          <p className="text-2xl font-bold text-green-400 mt-2">
            {data?.summary?.avg_match_rate_pct || 0}%
          </p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Peak Match Rate</p>
          <p className="text-2xl font-bold text-green-400 mt-2">
            {data?.summary?.max_match_rate_pct || 0}%
          </p>
        </div>
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
          <p className="text-slate-400 text-sm">Gateways Tracked</p>
          <p className="text-2xl font-bold text-blue-400 mt-2">
            {data?.by_gateway?.length || 0}
          </p>
        </div>
      </div>
    </div>
  );
}
