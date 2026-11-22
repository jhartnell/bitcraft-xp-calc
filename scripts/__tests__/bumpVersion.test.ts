import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  bumpProjectVersion,
  checkVersionConsistency,
  computeNextVersion,
  isValidSemver,
} from '../bump-version.mjs';

function seedWorkspace(dir: string, version: string) {
  mkdirSync(join(dir, 'client-side-only/browser-extension'), { recursive: true });

  writeFileSync(
    join(dir, 'package.json'),
    `${JSON.stringify({ name: 'bitcraft-xp-calc', version }, null, 2)}\n`,
    'utf8'
  );
  writeFileSync(
    join(dir, 'package-lock.json'),
    `${JSON.stringify({ name: 'bitcraft-xp-calc', version, packages: { '': { name: 'bitcraft-xp-calc', version } } }, null, 2)}\n`,
    'utf8'
  );
  writeFileSync(
    join(dir, 'client-side-only/browser-extension/manifest.json'),
    `${JSON.stringify({ manifest_version: 3, name: 'BitCraft', version }, null, 2)}\n`,
    'utf8'
  );
  writeFileSync(
    join(dir, 'nginx.conf'),
    `proxy_set_header User-Agent "Bitcraft-XP-Calculator-Proxy/${version}";\n`,
    'utf8'
  );
}

describe('bump-version helper script', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'bitcraft-version-test-'));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('validates SemVer and computes patch, minor, major, and explicit target versions', () => {
    expect(isValidSemver('1.10.4')).toBe(true);
    expect(isValidSemver('2.0.0-rc.1')).toBe(true);
    expect(isValidSemver('v1.10.4')).toBe(false);
    expect(isValidSemver('1.10')).toBe(false);

    expect(computeNextVersion('1.10.4', 'patch')).toBe('1.10.5');
    expect(computeNextVersion('1.10.4', 'minor')).toBe('1.11.0');
    expect(computeNextVersion('1.10.4', 'major')).toBe('2.0.0');
    expect(computeNextVersion('1.10.4', '1.12.0')).toBe('1.12.0');
    expect(computeNextVersion('1.10.4', 'v1.12.1-beta.1')).toBe('1.12.1-beta.1');
    expect(() => computeNextVersion('1.10.4', 'not-a-version')).toThrow();
  });

  it('supports dry-run without mutating files and bumps all 4 versioned files atomically', () => {
    seedWorkspace(tempDir, '1.10.4');

    const dry = bumpProjectVersion(tempDir, 'patch', { dryRun: true });
    expect(dry.previousVersion).toBe('1.10.4');
    expect(dry.nextVersion).toBe('1.10.5');
    expect(dry.dryRun).toBe(true);
    expect(checkVersionConsistency(tempDir).expectedVersion).toBe('1.10.4');

    const applied = bumpProjectVersion(tempDir, 'patch');
    expect(applied.nextVersion).toBe('1.10.5');
    expect(applied.dryRun).toBe(false);

    const check = checkVersionConsistency(tempDir);
    expect(check.ok).toBe(true);
    expect(check.expectedVersion).toBe('1.10.5');
    expect(readFileSync(join(tempDir, 'nginx.conf'), 'utf8')).toContain(
      'Bitcraft-XP-Calculator-Proxy/1.10.5'
    );
  });

  it('detects version drift across any individual synchronized file', () => {
    seedWorkspace(tempDir, '1.10.4');
    writeFileSync(
      join(tempDir, 'nginx.conf'),
      'proxy_set_header User-Agent "Bitcraft-XP-Calculator-Proxy/1.10.3";\n',
      'utf8'
    );

    const check = checkVersionConsistency(tempDir);
    expect(check.ok).toBe(false);
    expect(check.mismatches).toEqual([
      { label: 'nginx.conf (User-Agent)', version: '1.10.3' },
    ]);
  });
});
