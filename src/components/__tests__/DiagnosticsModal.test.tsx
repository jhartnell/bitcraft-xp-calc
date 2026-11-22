import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { DiagnosticsModal } from '../DiagnosticsModal';
import { ErrorBoundary } from '../ErrorBoundary';
import {
  clearDiagnosticEvents,
  setDiagnosticsSnapshotProvider,
} from '../../services/diagnosticsCollector';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('DiagnosticsModal & ErrorBoundary Crash Copy', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    clearDiagnosticEvents();
    setDiagnosticsSnapshotProvider(null);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('renders diagnostic preview, supports anonymization toggle, and copies report to clipboard', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    setDiagnosticsSnapshotProvider(() => ({
      selectedPlayer: { entityId: '576460752768705987', username: 'Ikuria', regionId: 8 },
      polling: {
        refreshIntervalSeconds: 30,
        isPaused: false,
        isLoading: false,
        lastUpdated: null,
        error: null,
      },
      crafts: {
        ownedActiveCount: 0,
        selectedCraftIndex: 0,
        nearbyCount: 0,
        hasCustomCraft: false,
        isActiveCraftHelper: false,
        activeCraft: null,
      },
      calculation: null,
      overrides: {
        skillOverrideCount: 0,
        hasFoodBuffOverride: false,
        hasCustomProgressPerAction: false,
      },
    }));

    await act(async () => {
      root.render(React.createElement(DiagnosticsModal, { isOpen: true, onClose: () => {} }));
    });

    const preview = container.querySelector('pre');
    expect(preview?.textContent).toContain('Ikuria');
    expect(preview?.textContent).toContain('576460752768705987');

    // Toggle anonymization on
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(checkbox).toBeTruthy();

    await act(async () => {
      checkbox!.click();
    });

    expect(preview?.textContent).not.toContain('Ikuria');
    expect(preview?.textContent).not.toContain('576460752768705987');
    expect(preview?.textContent).toContain('Player_1');

    // Click Copy to Clipboard
    const copyBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Copy to Clipboard')
    );
    expect(copyBtn).toBeTruthy();

    await act(async () => {
      copyBtn!.click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('Player_1');
    expect(container.textContent).toContain('Copied!');
  });

  it('provides a Copy Crash Diagnostics action inside ErrorBoundary when a child throws', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const BrokenChild: React.FC = () => {
      throw new Error('Synthetic render failure');
    };

    await act(async () => {
      root.render(
        React.createElement(ErrorBoundary, null, React.createElement(BrokenChild))
      );
    });

    expect(container.textContent).toContain('Something went wrong');
    expect(container.textContent).toContain('Synthetic render failure');

    const copyCrashBtn = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Copy Crash Diagnostics')
    );
    expect(copyCrashBtn).toBeTruthy();

    await act(async () => {
      copyCrashBtn!.click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText.mock.calls[0][0]).toContain('Synthetic render failure');
    expect(writeText.mock.calls[0][0]).toContain('CRASH CAPTURED');
    expect(container.textContent).toContain('Diagnostics Copied!');
  });
});
