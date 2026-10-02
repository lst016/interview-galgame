import {test} from 'node:test';import assert from 'node:assert/strict';import {filterQuestions,pageQuestions,safeExternalUrl,nextQuestion,personalTemplate,restoreSaved} from '../src/logic.js';
test('题库筛选、分页、续学边界及链接安全',()=>{const qs=[{id:'1',title:'Agent',category:'A',collection:'B',collections:['C'],answerText:'幂等'},{id:'2',title:'React',category:'D'}];assert.equal(filterQuestions(qs,{search:' 幂等 ',collection:'C'}).length,1);assert.equal(filterQuestions(qs,{status:'new'},{'1':{status:'mastered'}})[0].id,'2');assert.equal(pageQuestions(qs,2,1)[0].id,'2');assert.equal(nextQuestion(qs,'2'),null);assert.equal(nextQuestion(qs,'missing'),null);assert.equal(safeExternalUrl('javascript:alert(1)'),null);assert.equal(safeExternalUrl('file:///private/a'),null);assert.equal(safeExternalUrl('https://example.com'), 'https://example.com/');assert.ok(personalTemplate(qs[0]).includes('没有在生产环境'));});

test('草稿、口头作答、状态和续学队列能恢复；损坏数据可退回空状态',()=>{const saved={activeId:'q-1',queueIds:['q-1','q-2'],progress:{'q-1':{draft:'我的真实回答',oral:true,status:'review'}}};assert.deepEqual(restoreSaved(JSON.stringify(saved)),saved);assert.deepEqual(restoreSaved('oops'),{});assert.deepEqual(restoreSaved('null'),{});assert.equal(restoreSaved('{"progress":{"q":{"draft":23,"status":"invented"}}}').progress.q.status,'new');});

import {loadQuestionBanks} from '../src/logic.js';
test('小题库先显示，大题库和失败请求不会阻塞已有题目',async()=>{
 let finish;const slow=new Promise(resolve=>{finish=resolve;});const shown=[];
 const pending=loadQuestionBanks([{path:'data/slow.json',label:'slow'},{path:'data/fast.json',label:'fast'},{path:'data/bad.json',label:'bad'}],'/',qs=>shown.push(qs),async url=>url.includes('slow')?slow:url.includes('bad')?{ok:false}:{ok:true,json:async()=>({questions:[{id:'fast'}]})});
 await new Promise(resolve=>setImmediate(resolve));assert.deepEqual(shown,[[{id:'fast'}]]);
 finish({ok:true,json:async()=>({questions:[{id:'slow'}]})});const results=await pending;assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.equal(shown.length,2);
});

import {readFileSync} from 'node:fs';
test('默认备考题仅含显式筛选的有答案题目，保持原文与来源',()=>{
 const selection=JSON.parse(readFileSync(new URL('../public/data/role-selection.json',import.meta.url)));
 const bank=JSON.parse(readFileSync(new URL('../public/data/role-questions.json',import.meta.url)));
 assert.deepEqual(bank.questions.map(q=>q.id),selection.questionIds);
 assert.ok(bank.questions.length>100&&bank.questions.length<4000);
 for(const category of ['JavaScript','React','Vue','Java','计算机网络'])assert.ok(bank.questions.some(q=>q.category===category),category);assert.ok(bank.questions.some(q=>/密码.*加密|JWT.*篡改/.test(q.title)));
 for(const q of bank.questions){assert.ok(!q.answerMissing&&!q.answerExternalOnly);assert.ok(!/预训练|反向传播|梯度下降|LoRA|RLHF|Fusion.in.Decoder/i.test(q.title));assert.ok(q.answerMarkdown||q.answerText);}
});
