// Privacy-safe, 100% local browser diagnostics collector & formatter

import { bitjitaApi, isExtensionContext } from './apiClient';
import {
  DiagnosticEvent,
  recordDiagnosticEvent,
  getDiagnosticEvents,
  clearDiagnosticEvents,
  MAX_DIAGNOSTIC_EVENTS,
} from './diagnosticsBuffer';

export type { DiagnosticEvent };
export { recordDiagnosticEvent, getDiagnosticEvents, clearDiagnosticEvents, MAX_DIAGNOSTIC_EVENTS };

export interface DashboardDiagnosticsSnapshot {
  selectedPlayer: {
    entityId: string;
    username: string;
    regionId?: number;
    locationX?: number;
    locationZ?: number;
  } | null;
  polling: {
    refreshIntervalSeconds: number;
    isPaused: boolean;
    isLoading: boolean;
    lastUpdated: string | null;
    error: string | null;
  };
  crafts: {
    ownedActiveCount: number;
    selectedCraftIndex: number;
    nearbyCount: number;
    hasCustomCraft: boolean;
    isActiveCraftHelper: boolean;
    activeCraft: {
      entityId: string;
      buildingName?: string;
      claimName?: string;
      regionId?: number;
      ownerEntityId?: string;
      ownerUsername?: string;
      progress: number;
      totalActionsRequired: number;
      completed?: boolean;
      isPublic?: boolean;
      recipeId?: number;
      contributorsCount: number;
    } | null;
  };
  calculation: {
    skillId: number;
    skillName: string;
    currentLevel: number;
    isLevelInferred?: boolean;
    progressPerAction: number;
    actionDurationSeconds: number;
    xpMultiplier: number;
    xpPerHour: number;
    estimatedSecondsRemaining: number;
    hasToolMatch: boolean;
    isToolMissing: boolean;
  } | null;
  overrides: {
    skillOverrideCount: number;
    hasFoodBuffOverride: boolean;
    hasCustomProgressPerAction: boolean;
  };
}

export interface CrashDiagnosticInfo {
  message: string;
  stack?: string;
  componentStack?: string;
}

export interface DiagnosticsReport {
  schemaVersion: 1;
  generatedAt: string;
  anonymized: boolean;
  app: {
    version: string;
    runtime: 'chrome-extension' | 'web';
  };
  environment: {
    userAgent: string;
    platform: string;
    language: string;
    onLine: boolean;
    viewport: string;
    timeZone: string;
  };
  dashboard: DashboardDiagnosticsSnapshot | null;
  apiHealth: {
    lastFetchedAt: string | null;
    lastResponseTimeMs: number | null;
    rateLimitBackoffMs: number;
    activeRequestsCount: number;
    cachedEntriesCount: number;
    lastError: string | null;
    anomalies: Array<{
      endpoint: string;
      method: string;
      type: string;
      statusCode?: number;
      message: string;
      impact?: string;
      ageSeconds: number;
    }>;
    cachedEndpoints: Array<{
      endpoint: string;
      category: string;
      ageSeconds: number;
      ttlSeconds: number;
      isExpired: boolean;
    }>;
  };
  storage: {
    localStorageKeys: Record<string, unknown>;
    sessionStorageKeys: string[];
  };
  recentEvents: DiagnosticEvent[];
  crash?: CrashDiagnosticInfo;
}

const ALLOWED_STORAGE_PREFIX = 'bitcraft_';
const MAX_CLIPBOARD_BYTES = 24_000;

let snapshotProvider: (() => DashboardDiagnosticsSnapshot | null) | null = null;
let listenersInstalled = false;

export function setDiagnosticsSnapshotProvider(
  provider: (() => DashboardDiagnosticsSnapshot | null) | null
): void {
  snapshotProvider = provider;
}

export function installGlobalDiagnosticListeners(): void {
  if (listenersInstalled || typeof window === 'undefined') return;
  listenersInstalled = true;

  window.addEventListener('error', (event: ErrorEvent) => {
    recordDiagnosticEvent({
      level: 'error',
      source: 'window',
      message: event.message || 'Unhandled window error',
      details: {
        filename: event.filename ? event.filename.split('/').pop() : undefined,
        lineno: event.lineno || undefined,
        colno: event.colno || undefined,
        stack: event.error instanceof Error ? event.error.stack : undefined,
      },
    });
  });

  window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === 'string'
          ? reason
          : 'Unhandled promise rejection';
    recordDiagnosticEvent({
      level: 'error',
      source: 'promise',
      message,
      details: {
        stack: reason instanceof Error ? reason.stack : undefined,
      },
    });
  });
}

function readAllowlistedLocalStorage(): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (typeof localStorage === 'undefined') return result;

  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i);
      if (k && k.startsWith(ALLOWED_STORAGE_PREFIX)) {
        keys.push(k);
      }
    }
    keys.sort();
    for (const key of keys) {
      const raw = localStorage.getItem(key);
      if (raw === null) continue;
      try {
        result[key] = JSON.parse(raw);
      } catch {
        result[key] = raw;
      }
    }
  } catch {
    // Ignore restricted storage access
  }

  return result;
}

function readAllowlistedSessionStorageKeys(): string[] {
  if (typeof sessionStorage === 'undefined') return [];
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(ALLOWED_STORAGE_PREFIX)) {
        keys.push(k);
      }
    }
    return keys.sort();
  } catch {
    return [];
  }
}

class Redactor {
  private idMap = new Map<string, string>();
  private nameMap = new Map<string, string>();

  public maskId(id?: string | null): string {
    if (!id) return '';
    let masked = this.idMap.get(id);
    if (!masked) {
      masked = `id_${this.idMap.size + 1}`;
      this.idMap.set(id, masked);
    }
    return masked;
  }

  public maskName(name?: string | null): string {
    if (!name) return '';
    const key = name.toLowerCase();
    let masked = this.nameMap.get(key);
    if (!masked) {
      masked = `Player_${this.nameMap.size + 1}`;
      this.nameMap.set(key, masked);
    }
    return masked;
  }

  public maskEndpoint(endpoint: string): string {
    return endpoint
      .replace(/(\/players\/)([^/?]+)/g, (_, prefix: string, id: string) => `${prefix}${this.maskId(id)}`)
      .replace(/(\/crafts\/)([^/?]+)/g, (_, prefix: string, id: string) => `${prefix}${this.maskId(id)}`)
      .replace(/([?&]q=)([^&]+)/g, '$1[redacted]');
  }

  public maskText(text: string): string {
    let out = text;
    for (const [rawId, maskedId] of this.idMap.entries()) {
      if (rawId.length >= 4) {
        out = out.split(rawId).join(maskedId);
      }
    }
    for (const [rawName, maskedName] of this.nameMap.entries()) {
      if (rawName.length >= 2) {
        const re = new RegExp(rawName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        out = out.replace(re, maskedName);
      }
    }
    return out;
  }
}

function anonymizeReport(report: DiagnosticsReport): DiagnosticsReport {
  const redactor = new Redactor();

  // First pass: register known player/craft IDs & usernames from dashboard & storage
  if (report.dashboard?.selectedPlayer) {
    redactor.maskId(report.dashboard.selectedPlayer.entityId);
    redactor.maskName(report.dashboard.selectedPlayer.username);
  }
  if (report.dashboard?.crafts.activeCraft) {
    const ac = report.dashboard.crafts.activeCraft;
    redactor.maskId(ac.entityId);
    if (ac.ownerEntityId) redactor.maskId(ac.ownerEntityId);
    if (ac.ownerUsername) redactor.maskName(ac.ownerUsername);
  }

  const anonymizedDashboard: DashboardDiagnosticsSnapshot | null = report.dashboard
    ? {
        ...report.dashboard,
        selectedPlayer: report.dashboard.selectedPlayer
          ? {
              ...report.dashboard.selectedPlayer,
              entityId: redactor.maskId(report.dashboard.selectedPlayer.entityId),
              username: redactor.maskName(report.dashboard.selectedPlayer.username),
            }
          : null,
        crafts: {
          ...report.dashboard.crafts,
          activeCraft: report.dashboard.crafts.activeCraft
            ? {
                ...report.dashboard.crafts.activeCraft,
                entityId: redactor.maskId(report.dashboard.crafts.activeCraft.entityId),
                ownerEntityId: report.dashboard.crafts.activeCraft.ownerEntityId
                  ? redactor.maskId(report.dashboard.crafts.activeCraft.ownerEntityId)
                  : undefined,
                ownerUsername: report.dashboard.crafts.activeCraft.ownerUsername
                  ? redactor.maskName(report.dashboard.crafts.activeCraft.ownerUsername)
                  : undefined,
              }
            : null,
        },
      }
    : null;

  // Mask storage keys & values containing player/craft IDs or usernames
  const anonymizedStorageKeys: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(report.storage.localStorageKeys)) {
    const maskedKey = key.replace(
      /(bitcraft_(?:assisted_crafts|skill_overrides)_)(.+)$/,
      (_, prefix: string, id: string) => `${prefix}${redactor.maskId(id)}`
    );

    if (key === 'bitcraft_primary_player' && val && typeof val === 'object') {
      const p = val as { entityId?: string; username?: string };
      anonymizedStorageKeys[maskedKey] = {
        entityId: redactor.maskId(p.entityId),
        username: redactor.maskName(p.username),
      };
    } else if (key === 'bitcraft_recent_players' && Array.isArray(val)) {
      anonymizedStorageKeys[maskedKey] = val.map((item) => {
        if (item && typeof item === 'object') {
          const p = item as { entityId?: string; username?: string };
          return {
            entityId: redactor.maskId(p.entityId),
            username: redactor.maskName(p.username),
          };
        }
        return item;
      });
    } else if (key.startsWith('bitcraft_assisted_crafts_') && Array.isArray(val)) {
      anonymizedStorageKeys[maskedKey] = val.map((id) => redactor.maskId(String(id)));
    } else {
      anonymizedStorageKeys[maskedKey] = val;
    }
  }

  return {
    ...report,
    anonymized: true,
    dashboard: anonymizedDashboard,
    apiHealth: {
      ...report.apiHealth,
      lastError: report.apiHealth.lastError ? redactor.maskText(report.apiHealth.lastError) : null,
      anomalies: report.apiHealth.anomalies.map((a) => ({
        ...a,
        endpoint: redactor.maskEndpoint(a.endpoint),
        message: redactor.maskText(a.message),
      })),
      cachedEndpoints: report.apiHealth.cachedEndpoints.map((e) => ({
        ...e,
        endpoint: redactor.maskEndpoint(e.endpoint),
      })),
    },
    storage: {
      localStorageKeys: anonymizedStorageKeys,
      sessionStorageKeys: report.storage.sessionStorageKeys.map((k) =>
        k.replace(/(bitcraft_session_xp_)(.+)$/, (_, prefix: string, rest: string) => `${prefix}${redactor.maskId(rest)}`)
      ),
    },
    recentEvents: report.recentEvents.map((ev) => ({
      ...ev,
      message: redactor.maskText(ev.message),
      ...(ev.details
        ? {
            details: Object.fromEntries(
              Object.entries(ev.details).map(([k, v]) => [
                k,
                typeof v === 'string'
                  ? k === 'endpoint'
                    ? redactor.maskEndpoint(v)
                    : redactor.maskText(v)
                  : v,
              ])
            ),
          }
        : {}),
    })),
  };
}

export function buildDiagnosticsReport(options?: {
  anonymize?: boolean;
  crash?: CrashDiagnosticInfo;
}): DiagnosticsReport {
  const now = Date.now();
  const status = bitjitaApi.status;
  const cachedEntries = bitjitaApi.getCachedEntries();
  const anomalies = bitjitaApi.getAnomalies();

  let dashboard: DashboardDiagnosticsSnapshot | null = null;
  if (snapshotProvider) {
    try {
      dashboard = snapshotProvider();
    } catch {
      dashboard = null;
    }
  }

  let timeZone = 'unknown';
  try {
    timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown';
  } catch {
    // ignore
  }

  const report: DiagnosticsReport = {
    schemaVersion: 1,
    generatedAt: new Date(now).toISOString(),
    anonymized: false,
    app: {
      version: import.meta.env.VITE_APP_VERSION || '0.0.0',
      runtime: isExtensionContext() ? 'chrome-extension' : 'web',
    },
    environment: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      platform: typeof navigator !== 'undefined' ? navigator.platform || 'unknown' : 'unknown',
      language: typeof navigator !== 'undefined' ? navigator.language || 'unknown' : 'unknown',
      onLine: typeof navigator !== 'undefined' ? navigator.onLine : true,
      viewport:
        typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : 'unknown',
      timeZone,
    },
    dashboard,
    apiHealth: {
      lastFetchedAt: status.lastFetchedAt ? status.lastFetchedAt.toISOString() : null,
      lastResponseTimeMs: status.lastResponseTimeMs,
      rateLimitBackoffMs: status.rateLimitBackoffMs,
      activeRequestsCount: status.activeRequestsCount,
      cachedEntriesCount: cachedEntries.length,
      lastError: status.error,
      anomalies: anomalies.map((a) => ({
        endpoint: a.endpoint,
        method: a.method,
        type: a.type,
        ...(a.statusCode !== undefined ? { statusCode: a.statusCode } : {}),
        message: a.message,
        ...(a.impact ? { impact: a.impact } : {}),
        ageSeconds: Math.max(0, Math.floor((now - a.timestamp) / 1000)),
      })),
      cachedEndpoints: cachedEntries.slice(0, 40).map((entry) => ({
        endpoint: entry.endpoint,
        category: entry.category,
        ageSeconds: Math.max(0, Math.floor((now - entry.timestamp) / 1000)),
        ttlSeconds: Math.round(entry.ttlMs / 1000),
        isExpired: entry.isExpired,
      })),
    },
    storage: {
      localStorageKeys: readAllowlistedLocalStorage(),
      sessionStorageKeys: readAllowlistedSessionStorageKeys(),
    },
    recentEvents: getDiagnosticEvents(),
    ...(options?.crash ? { crash: options.crash } : {}),
  };

  return options?.anonymize ? anonymizeReport(report) : report;
}

export function formatDiagnosticsReport(
  report: DiagnosticsReport,
  format: 'markdown' | 'json' = 'markdown'
): string {
  let jsonPayload = JSON.stringify(report, null, 2);

  if (jsonPayload.length > MAX_CLIPBOARD_BYTES) {
    const trimmed: DiagnosticsReport = {
      ...report,
      apiHealth: {
        ...report.apiHealth,
        cachedEndpoints: report.apiHealth.cachedEndpoints.slice(0, 15),
      },
      recentEvents: report.recentEvents.slice(-20),
    };
    jsonPayload = JSON.stringify(trimmed, null, 2);
  }

  if (format === 'json') {
    return jsonPayload;
  }

  const playerLabel = report.dashboard?.selectedPlayer
    ? `${report.dashboard.selectedPlayer.username} (${report.dashboard.selectedPlayer.entityId})`
    : 'None';
  const craftLabel = report.dashboard?.crafts.activeCraft
    ? `${report.dashboard.crafts.activeCraft.buildingName || 'Craft'} [${report.dashboard.crafts.activeCraft.entityId}] (${report.dashboard.crafts.activeCraft.progress}/${report.dashboard.crafts.activeCraft.totalActionsRequired})`
    : 'Idle / None';
  const summaryLines = [
    `### BitCraft XP Calculator Diagnostics (v${report.app.version} • ${report.app.runtime})`,
    `- **Generated:** ${report.generatedAt}${report.anonymized ? ' _(anonymized)_' : ''}`,
    `- **Character:** ${playerLabel}`,
    `- **Active Craft:** ${craftLabel}`,
    `- **API Health:** ${report.apiHealth.anomalies.length} warning(s) • ${report.apiHealth.cachedEndpoints.length} cached endpoint(s) • backoff ${report.apiHealth.rateLimitBackoffMs}ms`,
    `- **Events Logged:** ${report.recentEvents.length}${report.crash ? ' • **CRASH CAPTURED**' : ''}`,
    '',
    '```json',
    jsonPayload,
    '```',
  ];

  return summaryLines.join('\n');
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall back to execCommand below
  }

  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
