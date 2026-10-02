"""Build an explicit application-engineering selection; never modify source banks."""
import json,re
from pathlib import Path
root=Path(__file__).resolve().parents[1]
collections={'PayerMax个人练习','PayerMax-AI-Agent-面试题与参考回答-匿名候选人','TabTin-专属面试题-技术专家','TabTin-专属面试题-简历与负责人面','TabTin-React-Electron-面试问答详解','TabTin-源码命中型面试问答','TabTin-完整面试作战图','Pi / TabTin工程专题78题','Pi / TabTin业务场景','Claude SDK与云端Agent20题','Agent Runtime技术冲刺','平台技术冲刺','RAG与知识技术冲刺','缓存问题专项'}
# ponytail: curated source scope plus title exclusions; manually revise IDs when the target role changes.
exclude=re.compile(r'预训练|反向传播|梯度下降|损失函数|训练模型|模型训练|训练数据|LoRA|QLoRA|RLHF|DPO|PPO|GPU.*训练|训练.*GPU|BERT|TAPAS|GNN|ColBERT|Fusion.in.Decoder|HippoRAG|REALM|Astute|Vue\s*2|React.*生命周期',re.I)
questions=sum([json.loads(p.read_text())['questions'] for p in sorted((root/'public/data').glob('bank-*.json'))],[])
selected=[q for q in questions if set(q.get('collections',[q['collection']]))&collections and not q.get('archived') and not q.get('answerMissing') and not q.get('answerExternalOnly') and not exclude.search(q['title'])]
selection={'label':'我的备考题','focus':['Agent SDK / MCP / 工具与权限','会话、上下文、持久化与恢复','客服、Dify、RAG 应用与评测','React / Electron / TypeScript','Java 后端、渠道消息与可靠性','真实项目表达与个人职责'],'excludedTopics':['模型训练、预训练及训练算法','论文模型与研究型 RAG 细节','过时前端题与无答案来源索引'],'questionIds':[q['id'] for q in selected]}
(root/'public/data/role-questions.json').write_text(json.dumps({'questions':selected},ensure_ascii=False,separators=(',',':'))+'\n')
(root/'public/data/role-catalog.json').write_text(json.dumps({'banks':[{'path':'data/role-questions.json','label':'我的备考题'}],'totalQuestions':len(selected),'focus':selection['focus']},ensure_ascii=False)+'\n')
(root/'public/data/role-selection.json').write_text(json.dumps(selection,ensure_ascii=False,indent=2)+'\n')
report='# 我的备考题筛选\n\n依据本地简历与岗位定向材料，只发布题目 ID 与通用备考范围，不发布简历、联系方式或私人面试记录。\n\n默认展示 '+str(len(selected))+' 道有参考答案的应用工程题；全部资料保留在独立入口，不再进入默认刷题队列。原题与答案不改写。\n\n'
report+='## 默认题目\n\n'+'\n'.join('- '+q['title'] for q in selected)+'\n'
(root/'ROLE-SELECTION.md').write_text(report)
print('Selected',len(selected),'of',len(questions));print('Categories',sorted({q['category'] for q in selected}))
