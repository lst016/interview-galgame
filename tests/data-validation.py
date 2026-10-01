#!/usr/bin/env python3
"""Small reproducible integrity check for exported study data."""
import json, re
from pathlib import Path
root = Path(__file__).resolve().parents[1]
read = lambda path: json.loads(path.read_text())
catalog = read(root/'public/data/catalog.json')
coverage = read(root/'public/data/coverage.json')
questions = []
for bank in catalog['banks']:
    chunk = read(root/'public'/bank['path'])['questions']
    assert len(chunk) == bank['count']
    assert all(q['category'] == bank['label'] for q in chunk)
    questions.extend(chunk)
assert len(questions) == catalog['total'] == coverage['outputQuestions']
assert len({q['id'] for q in questions}) == len(questions)
assert coverage['inputEntries'] == coverage['outputQuestions'] + coverage['mergedEntries']
assert sum(q['answerMissing'] for q in questions) == catalog['answerMissing']
assert sum(q['answerExternalOnly'] for q in questions) == catalog['answerExternalOnly']
assert sum(q['archived'] for q in questions) == coverage['archivedQuestions']
for q in questions:
    assert q['title'].strip() and q['collection'] in q['collections']
    assert q['sources'] and isinstance(q['answerMissing'], bool)
    assert q['answerMissing'] == (not bool(q['answerMarkdown'].strip()))
    assert not q['answerExternalOnly'] or not q['answerMarkdown']
    assert not q['sourceUrl'] or q['sourceUrl'].startswith(('https://','http://'))
    assert not re.search(r'/Users/|file://', json.dumps(q,ensure_ascii=False))
assert any(len(q['answerMarkdown']) > 15000 for q in questions), 'Long-form answers must not be truncated'
assert any('Claude SDK与云端Agent20题' in q['collections'] for q in questions)
assert any('缓存问题专项' in q['collections'] for q in questions)
assert sum('牛客外链索引' in q['collections'] for q in questions) == 158
assert (root/'THIRD-PARTY-NOTICES.md').read_text().count('MIT License') >= 5
print(f'Data validation passed: {len(questions)} records across {len(catalog["banks"])} shards')
