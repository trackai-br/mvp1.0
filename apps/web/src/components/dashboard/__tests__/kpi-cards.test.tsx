import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import KPICards from '../kpi-cards';

describe('KPICards Component', () => {
  const mockMetrics = {
    total_events: 15000,
    success_rate_pct: 94.2,
    match_rate_pct: 87.5,
    latency_p95_ms: 245,
    dlq_backlog: 8,
    uptime_pct: 99.9,
  };

  it('should render 6 KPI cards', () => {
    render(
      <KPICards metrics={mockMetrics} isLoading={false} period="7d" />
    );

    expect(screen.getByText('Total Events')).toBeInTheDocument();
    expect(screen.getByText('Success Rate')).toBeInTheDocument();
    expect(screen.getByText('Match Rate')).toBeInTheDocument();
    expect(screen.getByText('Latency p95')).toBeInTheDocument();
    expect(screen.getByText('DLQ Backlog')).toBeInTheDocument();
    expect(screen.getByText('Uptime')).toBeInTheDocument();
  });

  it('should display metric values', () => {
    render(
      <KPICards metrics={mockMetrics} isLoading={false} period="7d" />
    );

    expect(screen.getByText('15000')).toBeInTheDocument();
    expect(screen.getByText('94.2')).toBeInTheDocument();
    expect(screen.getByText('87.5')).toBeInTheDocument();
    expect(screen.getByText('245')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('99.9')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(
      <KPICards metrics={mockMetrics} isLoading={true} period="7d" />
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('should handle missing metrics gracefully', () => {
    render(
      <KPICards metrics={undefined} isLoading={false} period="7d" />
    );

    expect(screen.getByText('Total Events')).toBeInTheDocument();
    // Should render 0 or placeholder values, not crash
    expect(document.querySelectorAll('[class*="font-bold"]').length).toBeGreaterThan(0);
  });

  it('should use correct CSS classes for styling', () => {
    render(
      <KPICards metrics={mockMetrics} isLoading={false} period="7d" />
    );

    const gridContainer = document.querySelector('[class*="grid"]');
    expect(gridContainer).toHaveClass('grid');
    expect(gridContainer).toHaveClass('gap-4');
  });
});
