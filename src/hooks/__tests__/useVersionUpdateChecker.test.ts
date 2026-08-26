import { describe, it, expect, vi } from 'vitest';
import { checkForAppUpdate } from '../useVersionUpdateChecker';

describe('App Version Update Checker Service', () => {
  it('detects a new version when version.json has a newer version string', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: '1.4.0',
        buildTime: 1787732000000,
        builtAt: '2026-08-26T08:00:00Z',
      }),
    } as unknown as Response);

    const result = await checkForAppUpdate('1.3.2', mockFetch as unknown as typeof fetch);

    expect(result.hasUpdate).toBe(true);
    expect(result.latestVersion).toBe('1.4.0');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/version.json?t='),
      expect.objectContaining({
        cache: 'no-store',
      })
    );
  });

  it('returns hasUpdate: false when version.json matches current version', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        version: '1.3.2',
        buildTime: 1787732000000,
      }),
    } as unknown as Response);

    const result = await checkForAppUpdate('1.3.2', mockFetch as unknown as typeof fetch);

    expect(result.hasUpdate).toBe(false);
    expect(result.latestVersion).toBe(null);
  });

  it('handles network errors gracefully without crashing', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));

    const result = await checkForAppUpdate('1.3.2', mockFetch as unknown as typeof fetch);

    expect(result.hasUpdate).toBe(false);
    expect(result.latestVersion).toBe(null);
  });

  it('handles HTTP 404 or 500 error responses gracefully', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    } as unknown as Response);

    const result = await checkForAppUpdate('1.3.2', mockFetch as unknown as typeof fetch);

    expect(result.hasUpdate).toBe(false);
    expect(result.latestVersion).toBe(null);
  });
});
