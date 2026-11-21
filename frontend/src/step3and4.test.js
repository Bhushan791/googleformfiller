import test from 'node:test';
import assert from 'node:assert/strict';

test('Dry run sample CSV format logic', () => {
  const questions = [
    { entryId: '1', title: 'What is your name?' },
    { entryId: '2', title: 'Feedback text' },
  ];
  const responses = [
    { sentiment: 'positive', answers: { 1: 'Alice', 2: 'Love the app, great experience!' } },
    { sentiment: 'negative', answers: { 1: 'Bob', 2: 'Too slow and clunky.' } },
  ];

  const headers = ['#', 'Sentiment', ...questions.map((q) => `"${q.title.replace(/"/g, '""')}"`)];
  const rows = responses.map((r, idx) => {
    const rowAns = questions.map((q) => `"${String(r.answers[q.entryId] || '').replace(/"/g, '""')}"`);
    return [idx + 1, r.sentiment, ...rowAns].join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  assert.ok(csv.includes('"What is your name?"'));
  assert.ok(csv.includes('Love the app, great experience!'));
  assert.ok(csv.includes('Too slow and clunky.'));
});

test('Pacing and ETA calculations', () => {
  const count = 50;
  const delay = { minMs: 2000, maxMs: 6000 };
  const minMins = (((delay.minMs * count) / 60000)).toFixed(1);
  const maxMins = (((delay.maxMs * count) / 60000)).toFixed(1);

  assert.equal(minMins, '1.7');
  assert.equal(maxMins, '5.0');
});

test('Elapsed and ETA time formatting', () => {
  const formatSeconds = (sec) => {
    if (!sec || sec <= 0) return '0s';
    if (sec < 60) return `${sec}s`;
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins}m ${s}s`;
  };

  assert.equal(formatSeconds(0), '0s');
  assert.equal(formatSeconds(45), '45s');
  assert.equal(formatSeconds(125), '2m 5s');
});
