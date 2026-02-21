/**
 * Events Table — Filterable event log with detail modal
 */

import React, { useState } from 'react';

interface EventsTableProps {
  events: any[];
  isLoading: boolean;
  pagination: any;
  period: string;
}

export default function EventsTable({
  events,
  isLoading,
  pagination,
  period,
}: EventsTableProps) {
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  if (isLoading) return <div className="text-center py-12">Loading events...</div>;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700 border-b border-slate-600">
            <tr>
              <th className="px-6 py-3 text-left font-semibold">Event ID</th>
              <th className="px-6 py-3 text-left font-semibold">Status</th>
              <th className="px-6 py-3 text-left font-semibold">Gateway</th>
              <th className="px-6 py-3 text-left font-semibold">Latency (ms)</th>
              <th className="px-6 py-3 text-left font-semibold">Time</th>
              <th className="px-6 py-3 text-left font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {events.map((event: any) => (
              <tr
                key={event.id}
                className="hover:bg-slate-700/50 transition-colors"
              >
                <td className="px-6 py-4 font-mono text-xs text-blue-400">
                  {event.event_id?.slice(0, 12)}...
                </td>
                <td className="px-6 py-4">
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      event.status === 'sent'
                        ? 'bg-green-900 text-green-200'
                        : event.status === 'failed'
                        ? 'bg-red-900 text-red-200'
                        : 'bg-yellow-900 text-yellow-200'
                    }`}
                  >
                    {event.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {event.capi_event?.conversion?.gateway || 'N/A'}
                </td>
                <td className="px-6 py-4">{event.latency_ms}ms</td>
                <td className="px-6 py-4 text-slate-400">
                  {new Date(event.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => setSelectedEvent(event)}
                    className="text-blue-400 hover:text-blue-300 text-xs font-medium"
                  >
                    Details
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 max-w-2xl w-full mx-4 border border-slate-700">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Event Details</h3>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-white text-xl"
              >
                ✕
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-slate-400 text-sm">Event ID</p>
                <p className="font-mono text-blue-400">{selectedEvent.event_id}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Status</p>
                <p>{selectedEvent.status}</p>
              </div>
              <div>
                <p className="text-slate-400 text-sm">Response</p>
                <pre className="bg-slate-900 p-3 rounded text-xs overflow-auto max-h-40">
                  {JSON.stringify(
                    JSON.parse(selectedEvent.provider_response || '{}'),
                    null,
                    2
                  )}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pagination */}
      <div className="px-6 py-4 bg-slate-700/50 flex justify-between items-center text-sm text-slate-400">
        <span>
          Page {pagination?.page} of {pagination?.pages} ({pagination?.total} total)
        </span>
      </div>
    </div>
  );
}
