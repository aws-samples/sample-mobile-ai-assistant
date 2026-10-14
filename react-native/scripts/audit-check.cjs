#!/usr/bin/env node
// Fails on any npm audit advisory (any severity) unless it is listed in
// audit-allowlist.json. Allowlist entries are only for advisories that have no
// patched release yet, and each has a review date: once it passes, the check
// fails again so the entry has to be re-assessed (see SECURITY_DEPENDENCIES.md).
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ALLOWLIST_PATH = path.join(__dirname, '..', 'audit-allowlist.json');

/** Advisories reported by `npm audit --json`, keyed by GHSA id. */
function collectAdvisories(report) {
  const advisories = new Map();
  for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      // String entries point at another vulnerable package, not an advisory.
      if (typeof via !== 'object' || !via.url) {
        continue;
      }
      const id = via.url.split('/').pop();
      advisories.set(id, {
        id,
        package: via.name,
        severity: via.severity,
        title: via.title,
      });
    }
  }
  return [...advisories.values()];
}

/** Compares reported advisories with the allowlist as of `today` (YYYY-MM-DD). */
function evaluate(advisories, allowlist, today) {
  const allowed = new Map(allowlist.map(entry => [entry.id, entry]));
  const errors = [];
  const notes = [];
  for (const advisory of advisories) {
    const entry = allowed.get(advisory.id);
    if (!entry) {
      errors.push(
        `${advisory.id} (${advisory.package}, ${advisory.severity}): ${advisory.title}`
      );
    } else if (entry.package !== advisory.package) {
      errors.push(
        `${advisory.id} is allowlisted for ${entry.package} but reported for ${advisory.package}`
      );
    } else if (today > entry.reviewBy) {
      errors.push(
        `${advisory.id} (${advisory.package}) allowlist entry expired on ${entry.reviewBy}; re-check for a patched release`
      );
    }
  }
  const reported = new Set(advisories.map(advisory => advisory.id));
  for (const entry of allowlist) {
    if (!reported.has(entry.id)) {
      notes.push(
        `${entry.id} (${entry.package}) is no longer reported; remove it from audit-allowlist.json`
      );
    }
  }
  return { errors, notes };
}

function main() {
  const result = spawnSync('npm', ['audit', '--json'], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    console.error('npm audit did not return JSON:\n' + result.stderr);
    process.exit(1);
  }
  if (report.error) {
    console.error('npm audit failed: ' + JSON.stringify(report.error));
    process.exit(1);
  }
  const allowlist = JSON.parse(fs.readFileSync(ALLOWLIST_PATH, 'utf8'));
  const today = new Date().toISOString().slice(0, 10);
  const { errors, notes } = evaluate(
    collectAdvisories(report),
    allowlist,
    today
  );
  notes.forEach(note => console.log('note: ' + note));
  if (errors.length > 0) {
    console.error('npm audit found advisories that are not allowlisted:');
    errors.forEach(error => console.error('  ' + error));
    process.exit(1);
  }
  console.log(
    `npm audit: no unreviewed advisories (${allowlist.length} allowlisted).`
  );
}

if (require.main === module) {
  main();
}

module.exports = { collectAdvisories, evaluate };
