import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve('public');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'data/catalog.json'), 'utf8'));
const banks = catalog.banks.map(bank => {
  const filename = bank.path.replace(/^\.?\//, '');
  assert(!filename.includes('..'), 'bank path must stay in public');
  return { bank, questions: JSON.parse(fs.readFileSync(path.join(root, filename), 'utf8')).questions };
});
const questions = banks.flatMap(x => x.questions);

test('catalog counts equal shipped complete shards', () => {
  assert(questions.length > 3802, 'must include supplemental banks beyond the 3802-entry unified baseline');
  assert.equal(catalog.total, questions.length);
  for (const { bank, questions: items } of banks) assert.equal(bank.count, items.length);
});

test('each published question has a unique stable id and explicit answer boundary', () => {
  assert.equal(new Set(questions.map(q => q.id)).size, questions.length);
  for (const q of questions) {
    assert(q.id && q.title && q.category, `required question fields: ${q.id}`);
    assert(typeof q.answerMissing === 'boolean', `answerMissing: ${q.id}`);
    assert(typeof q.answerExternalOnly === 'boolean', `answerExternalOnly: ${q.id}`);
    if (!q.answerMissing && !q.answerExternalOnly) assert((q.answerMarkdown || q.answerText || '').trim(), `empty answer: ${q.id}`);
    if (q.sourceUrl) assert(/^https?:\/\//.test(q.sourceUrl), `nonpublic source link: ${q.id}`);
  }
});

test('published data excludes credentials, local file paths and unsafe URLs', () => {
  const data = JSON.stringify(questions);
  assert(!/\/Users\/|file:\/\/\/(?:Users|home)\//.test(data));
  assert(!/\b(?:sk-[a-zA-Z0-9]{20,}|gh[opusr]_[a-zA-Z0-9]{25,})\b/.test(data));
});
