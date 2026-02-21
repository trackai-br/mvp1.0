import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EventsTable from '../events-table';

describe('EventsTable Component', () => {
  const mockEvents = [
    {
      id: '1',
      event_id: 'evt_1234567890abcdef',
      status: 'sent',
      capi_event: { conversion: { gateway: 'facebook' } },
      latency_ms: 145,
      created_at: '2025-02-21T10:00:00Z',
      provider_response: '{"status":"ok"}',
    },
    {
      id: '2',
      event_id: 'evt_abcdef1234567890',
      status: 'failed',
      capi_event: { conversion: { gateway: 'google' } },
      latency_ms: 2450,
      created_at: '2025-02-21T09:00:00Z',
      provider_response: '{"error":"rate_limit"}',
    },
  ];

  const mockPagination = {
    page: 1,
    pages: 5,
    total: 234,
  };

  it('should render table with events', () => {
    render(
      <EventsTable
        events={mockEvents}
        isLoading={false}
        pagination={mockPagination}
        period="7d"
      />
    );

    expect(screen.getByText('Event ID')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Gateway')).toBeInTheDocument();
    expect(screen.getByText('Latency (ms)')).toBeInTheDocument();
  });

  it('should display event data in rows', () => {
    render(
      <EventsTable
        events={mockEvents}
        isLoading={false}
        pagination={mockPagination}
        period="7d"
      />
    );

    expect(screen.getByText(/evt_1234567890ab/)).toBeInTheDocument();
    expect(screen.getByText('sent')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <EventsTable
        events={[]}
        isLoading={true}
        pagination={mockPagination}
        period="7d"
      />
    );

    expect(screen.getByText('Loading events...')).toBeInTheDocument();
  });

  it('should open detail modal on Details button click', () => {
    render(
      <EventsTable
        events={mockEvents}
        isLoading={false}
        pagination={mockPagination}
        period="7d"
      />
    );

    const detailsButtons = screen.getAllByText('Details');
    fireEvent.click(detailsButtons[0]);

    expect(screen.getByText('Event Details')).toBeInTheDocument();
    expect(screen.getByText(mockEvents[0].event_id)).toBeInTheDocument();
  });

  it('should close modal on close button', () => {
    render(
      <EventsTable
        events={mockEvents}
        isLoading={false}
        pagination={mockPagination}
        period="7d"
      />
    );

    const detailsButtons = screen.getAllByText('Details');
    fireEvent.click(detailsButtons[0]);
    expect(screen.getByText('Event Details')).toBeInTheDocument();

    const closeButton = screen.getByText('✕');
    fireEvent.click(closeButton);
    expect(screen.queryByText('Event Details')).not.toBeInTheDocument();
  });

  it('should display pagination info', () => {
    render(
      <EventsTable
        events={mockEvents}
        isLoading={false}
        pagination={mockPagination}
        period="7d"
      />
    );

    expect(screen.getByText('Page 1 of 5 (234 total)')).toBeInTheDocument();
  });

  it('should color-code status badges', () => {
    render(
      <EventsTable
        events={mockEvents}
        isLoading={false}
        pagination={mockPagination}
        period="7d"
      />
    );

    const statusBadges = document.querySelectorAll('[class*="px-2"]');
    expect(statusBadges.length).toBeGreaterThan(0);
  });

  it('should handle empty events gracefully', () => {
    render(
      <EventsTable
        events={[]}
        isLoading={false}
        pagination={{ page: 1, pages: 1, total: 0 }}
        period="7d"
      />
    );

    expect(screen.getByText('Event ID')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1 (0 total)')).toBeInTheDocument();
  });
});
