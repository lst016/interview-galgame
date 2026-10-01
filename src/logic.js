export function filterQuestions(questions, {search='',category='',collection='',status=''}, progress={}) {
  const needle=search.trim().toLocaleLowerCase();
  return questions.filter(q => (!category || q.category===category) && (!collection || q.collection===collection || q.collections?.includes(collection)) && (!status || (progress[q.id]?.status || 'new')===status) && (!needle || `${q.title}\n${q.answerText||q.answerMarkdown||''}\n${q.section||''}`.toLocaleLowerCase().includes(needle)));
}
export function pageQuestions(questions,page,size=12) {return questions.slice((page-1)*size,page*size);}
export function safeExternalUrl(url) {try {const u=new URL(url);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
export function nextQuestion(questions,id) {const i=questions.findIndex(q=>q.id===id);return i>=0 ? questions[i+1] || null : null;}
export function personalTemplate(question) {return `我会先直接回答“${question.title}”。\n具体可以分为：目标与约束 → 实现步骤 → 异常处理 → 验证方式。\n如果我做过相关项目：在【真实项目】中，我负责【真实职责】，遇到【实际问题】，采取【实际做法】，结果是【可核实结果】。\n如果没有相关经历：我没有在生产环境直接做过这部分；基于我的理解，我会先【方案】，再通过【验证】确认。`;}
export function restoreSaved(raw) {
  try {const s=JSON.parse(raw||'{}');if(!s||typeof s!=='object'||Array.isArray(s))return {};const progress={};for(const [id,p] of Object.entries(s.progress||{})){if(!p||typeof p!=='object')continue;progress[id]={draft:typeof p.draft==='string'?p.draft:'',oral:p.oral===true,status:['mastered','review'].includes(p.status)?p.status:'new'};}return {progress,activeId:typeof s.activeId==='string'?s.activeId:'',queueIds:Array.isArray(s.queueIds)?s.queueIds.filter(id=>typeof id==='string'):[]};}catch{return {};}
}
