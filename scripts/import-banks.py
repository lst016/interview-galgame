#!/usr/bin/env python3
"""Rebuild public question snapshots from a local study directory (stdlib only)."""
import argparse, collections, hashlib, html, json, re
from pathlib import Path

PROJECT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, default=PROJECT.parent)
args = parser.parse_args()
ROOT = args.source
OUT = PROJECT / 'public/data'
OUT.mkdir(parents=True, exist_ok=True)
records, inventory, privacy_count = {}, [], 0
historical_skipped = 0
aliases = {}
private_names = {Path.home().name}
profile = ROOT / 'output/payermax-personal-interview-2026-09-22/题目数据.json'
if profile.exists():
    candidate = json.loads(profile.read_text()).get('candidate')
    if candidate: private_names.add(candidate)
SAFE_LICENSES = ('MIT', 'Apache-2.0', 'CC-BY-SA-4.0')
PERSONAL = re.compile(r'现有简历|我的简历|简历口径|简历已有|简历未|简历可|简历中|候选人经历|本人经历|我(?:曾|此前|负责|参与|做过|做的|的工作台|的客服|的项目|在项目|在客服|的经历)|约一半|四到五万|机器人会话拦截|今年四月|五年软件经验|一面已通过|简历主张|现有材料|现有经历|现有项目|本人已有|波克城市|摹范|全量前端|约.?80%|80%.{0,12}(?:拦截|会话)|(?:拦截|会话).{0,12}80%' + '|' + '|'.join(re.escape(n) for n in private_names))

def clean(text):
    text = str(text or '').replace('file://', '本地文件协议：')
    text = re.sub(r'/Users/[^\s\]\)"\'<>，；。]+', '[本地资料]', text)
    for name in private_names:
        text = text.replace(name, '匿名候选人')
    text = re.sub(r'(?<!\w)[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}(?!\w)', '[邮箱已隐去]', text, flags=re.I)
    return text

def sanitize_answer(text):
    global privacy_count
    parts = re.split(r'\n\s*\n', str(text or ''))
    kept = []
    for part in parts:
        if PERSONAL.search(part):
            privacy_count += 1
        else:
            kept.append(clean(part))
    result = '\n\n'.join(kept)
    # Keep references navigable without exposing source-machine paths.
    return result.strip()

def plain(text):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>|[#*`]', '', text))).strip()

def category(q):
    original = q.get('category') or q.get('group') or q.get('module') or 'AI Agent'
    if original in ('Java', 'React', 'Vue', 'JavaScript', 'HTML', 'AI Agent', 'Electron', '计算机网络', '面经考点'):
        return original
    if re.search('Java|JVM|并发|GC|类加载', original): return 'Java'
    if re.search('React|前端|TypeScript', original): return 'React'
    if re.search('网络', original): return '计算机网络'
    if re.search('个人|简历|负责人', original): return '项目与行为面试'
    return 'AI Agent'

def norm(text):
    text = re.sub(r'^(?:Q\d+(?:-\d+)?[.、:：\s]*|\d+[.、:：｜\s]*)', '', text, flags=re.I)
    return re.sub(r'[^\w\u4e00-\u9fff]+', '', text).lower()

def add(q, collection, origin_file, priority=0, local=False, membership_only=False):
    global historical_skipped
    title = clean(q.get('title') or q.get('question') or q.get('q') or '')
    if not title: return
    cat = category(q)
    key = cat + ':' + norm(title)
    source_id = str(q.get('id', ''))
    mapped_id = aliases.get(source_id, source_id)
    # Earlier collections can have translated titles; canonical IDs connect them.
    for old_key, old in records.items():
        if mapped_id and mapped_id in old['_ids']:
            key = old_key
            break
    archived = membership_only and key not in records
    if archived:
        collection = '归档题库 · 旧版独有'
    license_name = str(q.get('license') or ('本地原创学习材料；非实际经历' if local else '未明确许可'))
    source_url = q.get('sourceUrl') or q.get('url') or ''
    if not source_url:
        refs = q.get('references') or []
        source_url = next((r for r in refs if isinstance(r, str) and r.startswith('https://')), '')
    if not str(source_url).startswith(('https://', 'http://')): source_url = ''
    answer = q.get('completeAnswer') or q.get('answerMarkdown') or q.get('answer') or q.get('a') or q.get('answerText') or ''
    if not isinstance(answer, str): answer = json.dumps(answer, ensure_ascii=False, indent=2)
    followups = q.get('followups') or []
    for f in followups:
        if isinstance(f, dict):
            fq = f.get('q') or f.get('question') or f.get('title')
            fa = f.get('a') or f.get('answer')
            if fq and fa: answer += '\n\n### 追问：' + str(fq) + '\n\n' + str(fa)
    origin = str(q.get('completeAnswerOrigin') or q.get('answerOrigin') or '')
    original_text = bool(re.search('社区原答案|原文答案|保留英文原答案', origin))
    external = (not local or original_text) and not any(license_name.startswith(s) for s in SAFE_LICENSES)
    privacy = q.get('category') in ('个人项目', '简历与经历') or bool(re.search('专属面试题-简历与负责人面|PayerMax-AI-Agent-面试题与参考回答', collection))
    removed_before = privacy_count
    answer = '' if external or privacy else sanitize_answer(answer)
    answer_origin = clean(q.get('completeAnswerOrigin') or q.get('answerOrigin') or ('本地原创参考答案；教学设计，非已上线经历' if local else '开源原文/本地修订'))
    if external: answer_origin = '来源许可未明确，仅题干与链接；正文未发布'
    if privacy: answer_origin = '个人经历答案未公开，请自行填写自己的情况'
    item = dict(id='q-' + hashlib.sha256(key.encode()).hexdigest()[:16], title=title, category=cat,
                collection=clean(collection), collections=[clean(collection)], section=clean(q.get('section') or q.get('group') or ''),
                answerMarkdown=answer, answerText=plain(answer), sourceUrl=clean(source_url),
                answerOrigin=answer_origin, license=license_name, answerMissing=not bool(answer.strip()),
                answerExternalOnly=external, archived=archived, answerPrivacyRedacted=privacy or privacy_count > removed_before,
                sources=[{'file':clean(origin_file), 'id':clean(source_id), 'url':clean(source_url), 'license':license_name}],
                _priority=priority, _ids={mapped_id} if mapped_id else set())
    if key in records:
        old = records[key]
        cols = list(dict.fromkeys(old['collections'] + item['collections']))
        src = old['sources'] + [s for s in item['sources'] if s not in old['sources']]
        ids = old['_ids'] | item['_ids']
        if priority > old['_priority'] and (answer or not old['answerMarkdown']): old = item
        old['collections'], old['sources'], old['_ids'] = cols, src, ids
        records[key] = old
    else: records[key] = item

def load_json(rel, label, priority=0, local=False, nested=False, membership_only=False):
    p = ROOT / rel
    if not p.exists(): return
    data = json.loads(p.read_text())
    questions = data if isinstance(data, list) else data.get('questions', [])
    if nested: questions = [q for t in data['topics'] for q in t.get('questions', [])]
    inventory.append({'file':clean(rel), 'records':len(questions), 'collection':label, 'priority':priority})
    for q in questions:
        if 'open-react-question-bank' in rel:
            q = dict(q, id='react-export-'+q['id'], category='React', license=data['metadata']['license'])
        add(q, label if label else q.get('collection','统一题库'), rel, priority, local, membership_only)
    return data

def load_md(rel, label, pattern, priority=3):
    p = ROOT / rel
    if not p.exists(): return
    text = p.read_text(); matches = list(re.finditer(pattern, text, re.M))
    inventory.append({'file':clean(rel), 'records':len(matches), 'collection':label, 'priority':priority})
    for i,m in enumerate(matches):
        body = text[m.end():matches[i+1].start() if i+1<len(matches) else len(text)]
        add({'id':f'md-{hashlib.sha256(rel.encode()).hexdigest()[:8]}-{i}', 'title':m.group(1).strip(), 'answer':body,
             'answerOrigin':'本地原创参考答；合成教学设计，非个人实际经历'}, label, rel, priority, True)

unified_rel = 'output/unified-interview-bank/questions.json'
unified = json.loads((ROOT / unified_rel).read_text())
aliases = unified.get('aliases', {})
# Old exports add collection memberships; the latest unified copy wins their answer.
inventory.append({'file':unified_rel, 'records':len(unified['questions']), 'collection':'最新统一题库', 'priority':0})
for q in unified['questions']:
    add(q, q.get('collection','统一题库'), unified_rel, 0, '本地学习资料' in q.get('license',''))

load_json('output/full-stack-question-bank/questions.json', '全栈开源3386题', -2, membership_only=True)
load_json('output/open-react-question-bank/questions.json', 'React开源445题', -2, membership_only=True)

base = 'output/payermax-personal-interview-2026-09-22/'
load_json(base+'原题重建/原题与补充数据.json', 'PayerMax固定题与补充809题', 1, True)
load_json(base+'原题重建/我问过的技术题-合并数据.json', '技术追问与Java120题', 4, True, True)
for filename,label in [('题目数据.json','PayerMax个人练习'),('community.json','PayerMax社区精选'),('scenarios.json','岗位场景设计'),('extras.json','岗位额外练习'),('sprint-runtime.json','Agent Runtime技术冲刺'),('sprint-knowledge.json','RAG与知识技术冲刺'),('sprint-platform.json','平台技术冲刺')]:
    load_json(base+filename,label,2,True)
load_md('output/payermax-cloud-agent-followup-2026-09-24/一面反馈专项-Claude SDK与云端Agent.md','Claude SDK与云端Agent20题',r'^## \d+｜(.+)$',5)
load_md('output/tabtin-harness-course/业务场景面试题-含追问与答案.md','Pi / TabTin业务场景',r'^## [RST]\d+ · (.+)$',2)
load_md('output/unified-interview-bank/缓存常见问题-原因与解决方案.md','缓存问题专项',r'^## (\d+\..+)$',4)
# Link-only catalogs have no captured question content, so do not pretend they do.
inventory.append({'file':unified_rel+'#linkOnly', 'records':len(unified.get('linkOnly',[])), 'collection':'牛客外链索引', 'priority':0})
for i,link in enumerate(unified.get('linkOnly',[]),1):
    add({'id': 'nowcoder-'+link['id'], 'category':'React', 'title':f'牛客 React 外链索引 {i:03d}（题干未采集）', 'sourceUrl':link['url'], 'license':'无正文转载许可；仅链接'}, '牛客外链索引', unified_rel+'#linkOnly')

questions = sorted(records.values(), key=lambda q:(q['category'], q['id']))
for q in questions: q.pop('_priority'); q.pop('_ids')
groups = collections.defaultdict(list)
for q in questions: groups[q['category']].append(q)
banks = []
for cat,items in sorted(groups.items()):
    ident = hashlib.sha256(cat.encode()).hexdigest()[:10]
    filename = 'bank-'+ident+'.json'
    (OUT/filename).write_text(json.dumps({'questions':items},ensure_ascii=False,indent=2)+'\n')
    banks.append({'id':ident,'label':cat,'count':len(items),'path':'data/'+filename})
counts = collections.Counter(c for q in questions for c in q['collections'])
catalog = {'total':len(questions),'categories':[{'id':b['label'],'label':b['label'],'count':b['count']} for b in banks],
           'collections':[{'id':c,'label':c,'count':n} for c,n in sorted(counts.items())], 'banks':banks,
           'answerCount':sum(not q['answerMissing'] for q in questions),
           'answerMissing':sum(q['answerMissing'] for q in questions),
           'answerExternalOnly':sum(q['answerExternalOnly'] for q in questions)}
(OUT/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
coverage = {'inputFiles':len({i['file'].split('#')[0] for i in inventory}), 'inputEntries':sum(i['records'] for i in inventory),
            'outputQuestions':len(questions), 'mergedEntries':sum(i['records'] for i in inventory)-len(questions)-historical_skipped,
            'archivedQuestions':sum(q.get('archived',False) for q in questions),
            'answerMissing':catalog['answerMissing'],'answerExternalOnly':catalog['answerExternalOnly'],
            'privacyRedactedQuestions':sum(q['answerPrivacyRedacted'] for q in questions),
            'removedPrivacyParagraphs':privacy_count, 'inventory':inventory,
            'upstreamUnifiedInventory':json.loads(clean(json.dumps(unified['metadata'].get('inventory',[]),ensure_ascii=False))),
            'excluded':['实际面试逐字记录、简历原文件、主张证据账本、日报、源代码仓库、临时批次、历史备份、重复ZIP与云端包镜像','未采集题干的牛客158条仅作为外链索引','不发布原始sourceLocalPath/sourceFile/用户回答等字段'],
            'deduplication':'类别+规范化题目及统一库alias/source ID关联；同题保留全部集合与源文件；最新补答优先。不把完整章节内追问拆成伪独立原题。'}
(OUT/'coverage.json').write_text(json.dumps(coverage,ensure_ascii=False,indent=2)+'\n')
notices = ['# 第三方内容与许可\n','内容采用各自来源许可；网站代码许可不覆盖第三方题库。译文、补答与格式整理已由 answerOrigin 标识。CC BY SA 内容及其改写继续遵守 [CC BY SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)，署名和原文链接保留在每题 sources/sourceUrl。\n']
for lic in unified.get('licenses',[]):
    notices.extend(['## '+clean(lic['file'])+'\n', '```text\n'+lic['text']+'\n```\n'])
(PROJECT/'THIRD-PARTY-NOTICES.md').write_text('\n'.join(notices))
(PROJECT/'DATA-SOURCES.md').write_text('# 数据来源与导入覆盖\n\n'+f'当前导入 {len(questions)} 条记录；其中 {catalog["answerCount"]} 条有本地参考答案，{catalog["answerExternalOnly"]} 条仅来源链接。牛客158条为未采集题干的链接索引，不是完整问答。\n\n'+'所有参考工程场景均是教学设计；答案不是用户实际项目经历证明。个人经历答案未公开，含私人经历的段落移除，未重新编造。许可不明的第三方正文不发布。\n\n'+'重建：`python3 scripts/import-banks.py --source <学习资料目录>`。第三方许可证全文见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。精确输入/排除/合并/缺答统计见 [coverage.json](public/data/coverage.json)。\n\n'+'|输入|记录数|集合|\n|---|---:|---|\n'+''.join(f'|{clean(i["file"])}|{i["records"]}|{i["collection"]}|\n' for i in inventory))
print(json.dumps({k:v for k,v in coverage.items() if k not in ('inventory','upstreamUnifiedInventory')},ensure_ascii=False,indent=2))
