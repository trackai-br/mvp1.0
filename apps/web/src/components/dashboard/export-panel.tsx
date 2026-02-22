/**
 * Export Panel — CSV/JSON download with date range selector
 */

import React, { useState } from 'react';

interface ExportPanelProps {
  period: string;
  onPeriodChange: (period: '24h' | '7d' | '30d') => void;
}

export default function ExportPanel({ period, onPeriodChange }: ExportPanelProps) {
  const [format, setFormat] = useState<'csv' | 'json'>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [message, setMessage] = useState('');

  const handleExport = async () => {
    setIsExporting(true);
    setMessage('');

    try {
      const response = await fetch(
        `/api/v1/analytics/export/${format}?period=${period}`,
        { headers: { 'x-tenant-id': 'tenant-id' } }
      );

      if (!response.ok) {
        throw new Error(`Export failed with status ${response.status}`);
      }

      // Create blob and trigger download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `analytics-export-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);

      setMessage(`✅ Exported ${format.toUpperCase()} successfully`);
    } catch (error) {
      setMessage(`❌ Export failed: ${(error as Error).message}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Format Selector */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-6">Export Analytics Data</h3>

        <div className="space-y-6">
          {/* Period Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">Date Range</label>
            <div className="flex gap-2">
              {(['24h', '7d', '30d'] as const).map((p) => (
                <button
                  key={p}
                  onClick={() => onPeriodChange(p)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    period === p
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {p === '24h' ? 'Last 24h' : p === '7d' ? 'Last 7d' : 'Last 30d'}
                </button>
              ))}
            </div>
          </div>

          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">Export Format</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="csv"
                  checked={format === 'csv'}
                  onChange={(e) => setFormat(e.target.value as 'csv')}
                  className="w-4 h-4"
                />
                <span className="text-sm">CSV (Spreadsheet compatible)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  value="json"
                  checked={format === 'json'}
                  onChange={(e) => setFormat(e.target.value as 'json')}
                  className="w-4 h-4"
                />
                <span className="text-sm">JSON (For integrations)</span>
              </label>
            </div>
          </div>

          {/* Export Button */}
          <button
            onClick={handleExport}
            disabled={isExporting}
            className={`w-full px-6 py-3 rounded-lg font-medium transition-colors ${
              isExporting
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isExporting ? 'Exporting...' : `📥 Export as ${format.toUpperCase()}`}
          </button>

          {/* Message */}
          {message && (
            <div className={`p-4 rounded-lg text-sm ${
              message.startsWith('✅')
                ? 'bg-green-900 text-green-200'
                : 'bg-red-900 text-red-200'
            }`}>
              {message}
            </div>
          )}
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-700">
        <h4 className="font-semibold mb-3">📋 What's Included?</h4>
        <ul className="space-y-2 text-sm text-slate-300">
          <li>✓ Event logs (with PII masked)</li>
          <li>✓ Dispatch attempts (status, timestamps, errors)</li>
          <li>✓ Match rate metrics (daily breakdown by gateway)</li>
          <li>✓ Performance statistics (latency percentiles, throughput)</li>
          <li>✓ DLQ backlog and circuit breaker status</li>
        </ul>
      </div>

      {/* Limits Box */}
      <div className="bg-slate-700/50 rounded-lg p-6 border border-slate-700">
        <h4 className="font-semibold mb-3">⚠️ Export Limits</h4>
        <ul className="space-y-2 text-sm text-slate-300">
          <li>• Maximum 30-day period per export</li>
          <li>• PII (email, phone, IP) is automatically masked</li>
          <li>• Data is scoped to your tenant only</li>
          <li>• Exports are not logged in audit trail (GDPR compliance)</li>
        </ul>
      </div>
    </div>
  );
}
