// src/__tests__/screens.test.jsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import DataBoundary from '../components/DataBoundary.jsx';
import { AppProvider } from '../AppContext.jsx';

// Mock Leaflet and React-Leaflet
vi.mock('leaflet', () => ({
  default: {
    map: vi.fn(),
    tileLayer: vi.fn(),
    marker: vi.fn(),
    polygon: vi.fn(),
    icon: vi.fn(),
  },
  map: vi.fn(),
  tileLayer: vi.fn(),
}));

vi.mock('react-leaflet', () => ({
  MapContainer: ({ children }) => <div data-testid="mock-map-container">{children}</div>,
  TileLayer: () => <div data-testid="mock-tile-layer" />,
  Marker: ({ children }) => <div data-testid="mock-marker">{children}</div>,
  Popup: ({ children }) => <div data-testid="mock-popup">{children}</div>,
  Polygon: ({ children }) => <div data-testid="mock-polygon">{children}</div>,
  useMap: () => ({ setView: vi.fn(), fitBounds: vi.fn() }),
}));

// Mock API service layer to test exact states without live network
vi.mock('../services/api.js', () => ({
  API_BASE: 'https://test-api.carbonvault.local',
  getAuthToken: vi.fn(() => 'mock-jwt-token'),
  setAuthToken: vi.fn(),
  fetchOverviewStats: vi.fn().mockResolvedValue({ data: { projects_count: 5, credits_total: 1000 } }),
  fetchAuditLogs: vi.fn().mockResolvedValue({ data: [] }),
  fetchAllProjects: vi.fn().mockResolvedValue({ data: [{ id: 1, name: 'Amazon Delta', status: 'approved', credits: 500, price: 25 }] }),
  fetchMapProjects: vi.fn().mockResolvedValue({ data: { projects: [] } }),
  fetchTransactions: vi.fn().mockResolvedValue({ data: [] }),
  fetchWallet: vi.fn().mockResolvedValue({ data: { total_credits: 500, total_spent_usd: 12500 } }),
  fetchCorporateGrsScore: vi.fn().mockResolvedValue({ data: { score: 920, rank: 2, total: 10 } }),
  generateESGReport: vi.fn().mockResolvedValue({
    data: {
      has_data: true,
      meta: { company: 'Microsoft', reporting_year: 2026, scope: 'Portfolio' },
      esg_scores: { environmental: 88, social: 85, governance: 90 },
      environmental: { carbon_offset_total: 500, carbon_offset_value_usd: 12500, biodiversity_score: 0.9, water_conservation_ml: 625000 },
      social: { communities_supported: 3, jobs_created: 60, jobs_permanent: 20, jobs_seasonal: 40, csr_initiatives: 'Afforestation', training_hours: 1250 },
      governance: { compliance_score: 0.95, audit_status: 'Audited', risk_level: 'Low' },
      methodology: { verification_method: 'Satellite NDVI', engine: 'CarbonVault MRV', standards: ['GRI 305'] }
    }
  }),
  fetchLiveFxRate: vi.fn().mockResolvedValue({ data: { rate: 95.28 } }),
  fetchPublicConfig: vi.fn().mockResolvedValue({ data: { payment_mode: 'test', razorpay_status: 'ok' } }),
  fetchReady: vi.fn().mockResolvedValue({ data: { status: 'ready', razorpay_status: 'ok' } }),
  fetchPricingForecast: vi.fn().mockResolvedValue({ data: { trend_direction: 'upward', forecast: [] } }),
  fetchPricingConfig: vi.fn().mockResolvedValue({ data: { final_price: 28.5 } }),
  fetchMarketplaceListings: vi.fn().mockResolvedValue({ data: [] }),
  fetchPlantationTypes: vi.fn().mockResolvedValue({ data: [] }),
  checkSiteSuitability: vi.fn().mockResolvedValue({ data: { score: 85, suitable: true } }),
  fetchDashboard: vi.fn().mockResolvedValue({ data: { stats: {}, projects: [] } }),
  fetchProjects: vi.fn().mockResolvedValue({ data: [] }),
  loadRazorpayScript: vi.fn().mockResolvedValue(true),
  isBackendOnline: vi.fn(() => true),
  checkBackend: vi.fn().mockResolvedValue(true),
  fetchNotifications: vi.fn().mockResolvedValue({ data: [] }),
  markNotificationRead: vi.fn(),
  markAllNotificationsRead: vi.fn(),
  fetchCurrentUserProfile: vi.fn().mockResolvedValue({ data: { name: 'Alex Mercer', role: 'admin' } }),
}));

describe('R2-1: DataBoundary & Screen Lifecycle Sequences (No Hook Crashes / Minified #310)', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    // Monitor console.error to ensure no React warning or hook violation fires
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    cleanup();
  });

  describe('Sequence 1: loading → data', () => {
    it('transitions smoothly without calling hooks conditionally or throwing error #310', async () => {
      function TestComponent() {
        const [loading, setLoading] = useState(true);
        const [data, setData] = useState(null);

        // Simulated data load
        React.useEffect(() => {
          const timer = setTimeout(() => {
            setData({ name: 'Amazon Mangroves', credits: 450 });
            setLoading(false);
          }, 10);
          return () => clearTimeout(timer);
        }, []);

        return (
          <DataBoundary loading={loading} loadingMessage="Loading telemetry…">
            <div data-testid="content">
              {data && <span>{data.name} - {data.credits}t</span>}
            </div>
          </DataBoundary>
        );
      }

      render(<TestComponent />);
      expect(screen.getByTestId('data-boundary-loading')).toBeTruthy();

      await waitFor(() => {
        expect(screen.getByTestId('content')).toBeTruthy();
        expect(screen.getByText(/Amazon Mangroves - 450t/)).toBeTruthy();
      });

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/Rendered more hooks than during the previous render|#310/)
      );
    });
  });

  describe('Sequence 2: loading → error → retry → data', () => {
    it('handles failure, displays error state, allows onRetry, and loads data safely', async () => {
      function TestComponent() {
        const [loading, setLoading] = useState(true);
        const [error, setError] = useState(null);
        const [data, setData] = useState(null);
        const [attempts, setAttempts] = useState(0);

        React.useEffect(() => {
          setLoading(true);
          setError(null);
          const t = setTimeout(() => {
            if (attempts === 0) {
              setError('Database connection timeout (504 Gateway)');
              setLoading(false);
            } else {
              setData({ status: 'OK', records: 12 });
              setLoading(false);
            }
          }, 10);
          return () => clearTimeout(t);
        }, [attempts]);

        return (
          <DataBoundary
            loading={loading}
            error={error}
            onRetry={() => setAttempts(a => a + 1)}
          >
            <div data-testid="data-container">
              {data && <span>Records: {data.records}</span>}
            </div>
          </DataBoundary>
        );
      }

      render(<TestComponent />);

      // Initially loading
      expect(screen.getByTestId('data-boundary-loading')).toBeTruthy();

      // Enters error state
      await waitFor(() => {
        expect(screen.getByTestId('data-boundary-error')).toBeTruthy();
        expect(screen.getByText(/Database connection timeout/)).toBeTruthy();
      });

      // Click retry
      const retryBtn = screen.getByRole('button', { name: /Try again/i });
      fireEvent.click(retryBtn);

      // Successfully recovers to data
      await waitFor(() => {
        expect(screen.getByTestId('data-container')).toBeTruthy();
        expect(screen.getByText('Records: 12')).toBeTruthy();
      });

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/Rendered more hooks than during the previous render|#310/)
      );
    });
  });

  describe('Sequence 3: loading → empty', () => {
    it('transitions to empty state cleanly when zero records are returned', async () => {
      function TestComponent() {
        const [loading, setLoading] = useState(true);
        const [items, setItems] = useState([]);

        React.useEffect(() => {
          setTimeout(() => {
            setItems([]);
            setLoading(false);
          }, 10);
        }, []);

        return (
          <DataBoundary
            loading={loading}
            isEmpty={!loading && items.length === 0}
            emptyTitle="No carbon projects available"
            emptyMessage="Zero projects currently listed under this criteria."
          >
            <div data-testid="items-list">
              {items.map((it, i) => <div key={i}>{it}</div>)}
            </div>
          </DataBoundary>
        );
      }

      render(<TestComponent />);
      expect(screen.getByTestId('data-boundary-loading')).toBeTruthy();

      await waitFor(() => {
        expect(screen.getByTestId('data-boundary-empty')).toBeTruthy();
        expect(screen.getByText('No carbon projects available')).toBeTruthy();
      });

      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/Rendered more hooks than during the previous render|#310/)
      );
    });
  });

  describe('Sequence 4: rapid re-render stress test', () => {
    it('maintains consistent hook order across 25 rapid status toggles', () => {
      function RapidHookComponent({ tick }) {
        // Hooks always declared first unconditionally
        const [count, setCount] = useState(tick);
        const [history, setHistory] = useState([]);

        React.useEffect(() => {
          setCount(tick);
          setHistory(h => [...h, tick]);
        }, [tick]);

        const status = tick % 3 === 0 ? 'loading' : tick % 3 === 1 ? 'error' : 'success';

        return (
          <DataBoundary
            status={status}
            error={status === 'error' ? `Failure on tick ${tick}` : null}
          >
            <div data-testid="rapid-content">
              Tick: {count}, History length: {history.length}
            </div>
          </DataBoundary>
        );
      }

      const { rerender } = render(<RapidHookComponent tick={0} />);

      for (let i = 1; i <= 25; i++) {
        rerender(<RapidHookComponent tick={i} />);
      }

      // No hook violation or invariant error must ever be thrown
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringMatching(/Rendered more hooks than during the previous render|#310/)
      );
    });
  });
});
