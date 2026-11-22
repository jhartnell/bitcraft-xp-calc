import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { bitjitaApi } from '../apiClient';
import {
  MAX_DIAGNOSTIC_EVENTS,
  buildDiagnosticsReport,
  clearDiagnosticEvents,
  formatDiagnosticsReport,
  getDiagnosticEvents,
  recordDiagnosticEvent,
  setDiagnosticsSnapshotProvider,
} from '../diagnosticsCollector';

describe('diagnosticsCollector', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    bitjitaApi.clearCache();
    bitjitaApi.clearAnomalies();
    clearDiagnosticEvents();
    setDiagnosticsSnapshotProvider(null);
  });

  afterEach(() => {
    setDiagnosticsSnapshotProvider(null);
    clearDiagnosticEvents();
  });

  it('bounds the runtime diagnostic event ring buffer to MAX_DIAGNOSTIC_EVENTS', () => {
    for (let i = 0; i < MAX_DIAGNOSTIC_EVENTS + 15; i += 1) {
      recordDiagnosticEvent({
        level: 'info',
        source: 'app',
        message: `Event #${i}`,
      });
    }

    const events = getDiagnosticEvents();
    expect(events.length).toBe(MAX_DIAGNOSTIC_EVENTS);
    expect(events[0].message).toBe('Event #15');
    expect(events[events.length - 1].message).toBe(`Event #${MAX_DIAGNOSTIC_EVENTS + 14}`);
  });

  it('includes only allowlisted bitcraft_* storage keys and excludes unrelated or sensitive keys', () => {
    localStorage.setItem('bitcraft_refresh_interval', '30');
    localStorage.setItem('bitcraft_assisted_crafts_12345', JSON.stringify(['98765']));
    localStorage.setItem('auth_token', 'super-secret-jwt');
    localStorage.setItem('unrelated_app_key', 'private');
    sessionStorage.setItem('bitcraft_session_xp_12345', '[]');
    sessionStorage.setItem('secret_session_cookie', 'nope');

    const report = buildDiagnosticsReport();

    expect(Object.keys(report.storage.localStorageKeys)).toEqual([
      'bitcraft_assisted_crafts_12345',
      'bitcraft_refresh_interval',
    ]);
    expect(report.storage.localStorageKeys['auth_token']).toBeUndefined();
    expect(report.storage.localStorageKeys['unrelated_app_key']).toBeUndefined();
    expect(report.storage.sessionStorageKeys).toEqual(['bitcraft_session_xp_12345']);
  });

  it('anonymizes player usernames, entity IDs, endpoint paths, and storage keys when enabled', () => {
    localStorage.setItem(
      'bitcraft_primary_player',
      JSON.stringify({ entityId: '576460752768705987', username: 'Ikuria' })
    );
    localStorage.setItem(
      'bitcraft_assisted_crafts_576460752768705987',
      JSON.stringify(['1008806317066192960'])
    );

    bitjitaApi.recordAnomaly({
      endpoint: '/players/576460752768705987',
      method: 'GET',
      type: 'null_payload',
      message: 'Missing experience for Ikuria (576460752768705987)',
    });

    setDiagnosticsSnapshotProvider(() => ({
      selectedPlayer: {
        entityId: '576460752768705987',
        username: 'Ikuria',
        regionId: 8,
      },
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
        nearbyCount: 1,
        hasCustomCraft: true,
        isActiveCraftHelper: false,
        activeCraft: {
          entityId: '1008806317066192960',
          buildingName: 'Exquisite Forestry Station',
          ownerEntityId: '576460752766901931',
          ownerUsername: 'Oaktavia',
          progress: 125000,
          totalActionsRequired: 1275580,
          completed: false,
          isPublic: true,
          contributorsCount: 1,
        },
      },
      calculation: null,
      overrides: {
        skillOverrideCount: 0,
        hasFoodBuffOverride: false,
        hasCustomProgressPerAction: false,
      },
    }));

    const anonymized = buildDiagnosticsReport({ anonymize: true });
    const serialized = formatDiagnosticsReport(anonymized, 'markdown');

    expect(anonymized.anonymized).toBe(true);
    expect(serialized).not.toContain('Ikuria');
    expect(serialized).not.toContain('Oaktavia');
    expect(serialized).not.toContain('576460752768705987');
    expect(serialized).not.toContain('1008806317066192960');
    expect(serialized).toContain('Player_1');
    expect(serialized).toContain('id_1');
  });

  it('formats Markdown and JSON reports including captured crash context', () => {
    const report = buildDiagnosticsReport({
      crash: {
        message: 'Cannot read properties of undefined',
        stack: 'TypeError: Cannot read properties of undefined',
        componentStack: 'in ActiveCraftCard',
      },
    });

    const md = formatDiagnosticsReport(report, 'markdown');
    const json = formatDiagnosticsReport(report, 'json');

    expect(md).toContain('### BitCraft XP Calculator Diagnostics');
    expect(md).toContain('CRASH CAPTURED');
    expect(md).toContain('```json');
    expect(JSON.parse(json).crash.message).toBe('Cannot read properties of undefined');
  });
});
