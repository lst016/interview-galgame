import fs from 'node:fs';
import assert from 'node:assert/strict';
const catalog = JSON.parse(fs.readFileSync('public/data/catalog.json', 'utf8'));
let count = 0;
for (const bank of catalog.banks) {
  const data = JSON.parse(fs.readFileSync(`public/${bank.path.replace(/^\.?\//, '')}`, 'utf8'));
  for (const q of data.questions) {
    const text = JSON.stringify(q);
    for (const [label, pattern] of Object.entries({
      localPath: /\/Users\/|file:\/\/(?!\.\.\.)/,
      credential: /\b(?:sk-[a-zA-Z0-9]{20,}|gh[opusr]_[a-zA-Z0-9]{25,})\b/,
    })) assert(!pattern.test(text), `${label}: question ${q.id}`);
    for (const term of (process.env.PRIVATE_TERMS || '').split(',').filter(Boolean)) assert(!text.includes(term), `private term: ${q.id}`);
    if (q.sourceUrl) assert(/^https?:\/\//.test(q.sourceUrl), `nonpublic source URL: ${q.id}`);
    const emails = text.match(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*\.[a-zA-Z]{2,}/g) || [];
    assert(emails.every(email => /@(?:[\w-]+\.)*example\.(?:com|org|net|invalid)$|@localhost$/i.test(email)), `unreviewed email: question ${q.id}`);
    assert(typeof q.answerMissing === 'boolean', `missing answer boundary: ${q.id}`);
    count++;
  }
}
console.log(`Public content audit passed: ${count} questions`);
