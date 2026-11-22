import { describe, it, expect } from 'vitest';
import {
  buildReleaseNotes,
  extractChangelogSection,
  validateReleaseTag,
} from '../extract-release-notes.mjs';

const SAMPLE_CHANGELOG = `# Changelog

## [Unreleased]

### Added
- Pending feature

---

## [1.9.1] - 2026-11-21

### Fixed
- **Automatic Pruning:** Prunes completed and 404 crafts from localStorage.
- **Self-Cleaning Cache:** Clears retired craft anomalies.

---

## [1.9.0] - 2026-11-21

### Security
- Hardened Docker runtime.
`;

describe('extract-release-notes', () => {
  it('validates SemVer release tags including prereleases and rejects unsafe inputs', () => {
    expect(validateReleaseTag('v1.9.1')).toEqual({ tag: 'v1.9.1', version: '1.9.1' });
    expect(validateReleaseTag('v2.0.0-rc.1')).toEqual({ tag: 'v2.0.0-rc.1', version: '2.0.0-rc.1' });
    expect(() => validateReleaseTag('1.9.1')).toThrow();
    expect(() => validateReleaseTag('v1.9.1; rm -rf /')).toThrow();
    expect(() => validateReleaseTag('')).toThrow();
  });

  it('extracts the exact changelog section without leaking neighboring versions or trailing dividers', () => {
    const section = extractChangelogSection(SAMPLE_CHANGELOG, '1.9.1');
    expect(section).toContain('### Fixed');
    expect(section).toContain('Automatic Pruning');
    expect(section).not.toContain('Pending feature');
    expect(section).not.toContain('Hardened Docker runtime');
    expect(section?.endsWith('---')).toBe(false);
  });

  it('returns null when no matching version section exists', () => {
    expect(extractChangelogSection(SAMPLE_CHANGELOG, '9.9.9')).toBeNull();
  });

  it('builds formatted release notes with GHCR pull command and browser extension instructions', () => {
    const notes = buildReleaseNotes({
      tag: 'v1.9.1',
      changelogContent: SAMPLE_CHANGELOG,
      repository: 'JHartnell/bitcraft-xp-calc',
    });

    expect(notes).not.toBeNull();
    expect(notes).toContain('Automatic Pruning');
    expect(notes).toContain('docker pull ghcr.io/jhartnell/bitcraft-xp-calc:1.9.1');
    expect(notes).toContain('bitcraft-xp-calc-extension-v1.9.1.zip');
    expect(notes).toContain('SHA256SUMS.txt');
  });

  it('returns null from buildReleaseNotes when changelog entry is missing so CI falls back to --generate-notes', () => {
    const notes = buildReleaseNotes({
      tag: 'v1.9.2',
      changelogContent: SAMPLE_CHANGELOG,
      repository: 'jhartnell/bitcraft-xp-calc',
    });
    expect(notes).toBeNull();
  });
});
