import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import EventsTable from '../events-table';

describe('EventsTable Component', () => {
  const mockEvents = [
    {
      id: '1',
      eventId: 'evt_1234567890abcdef',
      status: 'success',
      error: undefined,
      attempt: 1,
      createdAt: '2025-02-21T10:00:00Z',
    },
    {
      id: '2',
      eventId: 'evt_abcdef1234567890',
      status: 'failed',
      error: 'rate_limit',
      attempt: 2,
      createdAt: '2025-02-21T09:00:00Z',
    },
  ];

  const mockPagination: {page: number; pages: number; total: number} = {
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
      />
    );

    expect(screen.getByText('Event ID')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Attempt')).toBeInTheDocument();
    expect(screen.getByText('Time')).toBeInTheDocument();
  });

  it('should display event data in rows', () => {
    render(
      <EventsTable
        events={mockEvents}
        isLoading={false}
        pagination={mockPagination}
      />
    );

    // Check that table contains the status values from mock events
    expect(screen.getByText('success')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    // Check that attempt numbers are displayed
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <EventsTable
        events={[]}
        isLoading={true}
        pagination={mockPagination}
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
      />
    );

    const detailsButtons = screen.getAllByText('Details');
    fireEvent.click(detailsButtons[0]);

    expect(screen.getByText('Event Details')).toBeInTheDocument();
    expect(screen.getByText(mockEvents[0].eventId)).toBeInTheDocument();
  });

  it('should close modal on close button', () => {
    render(
      <EventsTable
        events={mockEvents}
        isLoading={false}
        pagination={mockPagination}
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
      />
    );

    expect(screen.getByText('Event ID')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 1 (0 total)')).toBeInTheDocument();
  });
});
