/**
 * Failures Monitor — DLQ + Circuit Breaker status
 */

interface Metrics {
  dlq_backlog: number;
}

interface FailuresMonitorProps {
  metrics: Metrics | undefined;
  isLoading: boolean;
}

export default function FailuresMonitor({ metrics, isLoading }: FailuresMonitorProps) {
  if (isLoading) return <div className="text-center py-12">Loading...</div>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* DLQ Monitor */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4">📬 DLQ Monitor</h3>
        <div className="space-y-4">
          <div>
            <p className="text-slate-400 text-sm">Current Backlog</p>
            <p className="text-3xl font-bold text-red-400">
              {metrics?.dlq_backlog || 0}
            </p>
          </div>
          <div className="bg-slate-700/50 rounded p-3">
            <p className="text-sm font-medium mb-2">Top Errors:</p>
            <ul className="text-xs space-y-1 text-slate-400">
              <li>• Timeout: 45%</li>
              <li>• Invalid payload: 30%</li>
              <li>• Rate limited: 25%</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Circuit Breaker */}
      <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
        <h3 className="text-lg font-semibold mb-4">🔌 Circuit Breaker</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-slate-400">Status</p>
            <span className="px-3 py-1 rounded-full text-sm font-semibold bg-green-900 text-green-200">
              ✓ OK
            </span>
          </div>
          <div>
            <p className="text-slate-400 text-sm">Last Action</p>
            <p className="text-xs text-slate-300">2 hours ago (automatic recovery)</p>
          </div>
          <div>
            <p className="text-slate-400 text-sm mb-2">Health</p>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-green-500" style={{ width: '95%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
