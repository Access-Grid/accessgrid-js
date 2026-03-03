const fs = require('fs');
const path = require('path');

// ══════════════════════════════════════════════════════════════════════════════
// TARGET VERSION - Update this when upgrading Node.js
// ══════════════════════════════════════════════════════════════════════════════
const TARGET_NODE = '22.14.0';

const root = path.resolve(__dirname, '..', '..');

function readToolVersions() {
  const content = fs.readFileSync(path.join(root, '.tool-versions'), 'utf-8');
  const versions = {};
  content.split('\n').filter(Boolean).forEach(line => {
    const [tool, version] = line.split(/\s+/, 2);
    versions[tool] = version;
  });
  return versions;
}

function readCIJobs() {
  const content = fs.readFileSync(
    path.join(root, '.github', 'workflows', 'ci.yml'),
    'utf-8'
  );

  // Split into jobs by matching top-level job keys (2-space indented)
  const jobBlocks = content.split(/\n  (?=\w[\w-]*:)/);
  const jobs = {};

  jobBlocks.forEach(block => {
    const nameMatch = block.match(/^([\w-]+):/m);
    if (!nameMatch) return;
    const jobName = nameMatch[1];

    const versions = [];

    // Matrix arrays: node: ['20', '22', '24']
    const matrixMatch = block.match(/node:\s*\[([^\]]+)\]/);
    if (matrixMatch) {
      matrixMatch[1].split(',').forEach(v => {
        versions.push(v.trim().replace(/['"]/g, ''));
      });
    }

    // Standalone: node-version: '22'
    const standaloneMatches = [...block.matchAll(/node-version:\s*['"]?(\d+)['"]?/g)];
    standaloneMatches.forEach(m => {
      if (!versions.includes(m[1])) {
        versions.push(m[1]);
      }
    });

    if (versions.length > 0) {
      jobs[jobName] = versions;
    }
  });

  return jobs;
}

function majorVersion(version) {
  return version.split('.')[0];
}

describe('Node.js versions', () => {
  describe('.tool-versions', () => {
    test('node version matches target', () => {
      const toolVersions = readToolVersions();
      expect(toolVersions.nodejs).toBe(TARGET_NODE);
    });
  });

  describe('CI workflow', () => {
    const jobs = readCIJobs();
    const targetMajor = majorVersion(TARGET_NODE);

    test.each(Object.entries(jobs))(
      '%s job includes target major version (%s)',
      (jobName, versions) => {
        expect(versions).toContain(targetMajor);
      }
    );

    test.each(Object.entries(jobs))(
      '%s job only contains valid major versions',
      (jobName, versions) => {
        versions.forEach(v => {
          expect(v).toMatch(/^\d+$/);
        });
      }
    );

    test('.tool-versions major is tested in every CI job', () => {
      const toolMajor = majorVersion(readToolVersions().nodejs);
      Object.entries(jobs).forEach(([jobName, versions]) => {
        expect(versions).toContain(toolMajor);
      });
    });
  });
});
