const assert = require('node:assert/strict');
const test = require('node:test');
const { collectAdvisories, evaluate } = require('./audit-check.cjs');

const report = {
  vulnerabilities: {
    braces: {
      via: [
        {
          name: 'braces',
          severity: 'high',
          title: 'stack exhaustion',
          url: 'https://github.com/advisories/GHSA-vfj7-8cjw-p6xm',
        },
      ],
    },
    micromatch: { via: ['braces'] },
  },
};
const allowlist = [
  { id: 'GHSA-vfj7-8cjw-p6xm', package: 'braces', reviewBy: '2026-11-30' },
];

test('collects advisories, not packages that only depend on them', () => {
  assert.deepEqual(collectAdvisories(report), [
    {
      id: 'GHSA-vfj7-8cjw-p6xm',
      package: 'braces',
      severity: 'high',
      title: 'stack exhaustion',
    },
  ]);
});

test('passes when every advisory is allowlisted and not expired', () => {
  const { errors } = evaluate(
    collectAdvisories(report),
    allowlist,
    '2026-10-14'
  );
  assert.deepEqual(errors, []);
});

test('fails on any advisory missing from the allowlist', () => {
  const advisories = [
    ...collectAdvisories(report),
    {
      id: 'GHSA-new',
      package: 'left-pad',
      severity: 'low',
      title: 'new issue',
    },
  ];
  const { errors } = evaluate(advisories, allowlist, '2026-10-14');
  assert.equal(errors.length, 1);
  assert.match(errors[0], /GHSA-new/);
});

test('fails once an allowlist entry passes its review date', () => {
  const { errors } = evaluate(
    collectAdvisories(report),
    allowlist,
    '2026-12-01'
  );
  assert.equal(errors.length, 1);
  assert.match(errors[0], /expired/);
});

test('fails when the allowlisted id is reported for another package', () => {
  const advisories = [{ ...collectAdvisories(report)[0], package: 'other' }];
  const { errors } = evaluate(advisories, allowlist, '2026-10-14');
  assert.equal(errors.length, 1);
});

test('notes stale allowlist entries without failing', () => {
  const { errors, notes } = evaluate([], allowlist, '2026-10-14');
  assert.deepEqual(errors, []);
  assert.equal(notes.length, 1);
});
