import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {filterQuestions,pageQuestions,safeExternalUrl,nextQuestion,personalTemplate,restoreSaved,loadQuestionBanks} from './logic.js';
import './style.css';
const BASE=import.meta.env.BASE_URL;
const KEY='interview-galgame-v1';
function readSaved(){try{return restoreSaved(localStorage.getItem(KEY));}catch{return {};}}
function App(){
 const [saved,setSaved]=useState(readSaved),[storageError,setStorageError]=useState('');
 const [questions,setQuestions]=useState([]),[catalog,setCatalog]=useState(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[bankLoad,setBankLoad]=useState({done:0,total:0}),[loadWarning,setLoadWarning]=useState('');
 const [view,setView]=useState('library'),[activeId,setActiveId]=useState(saved.activeId||''),[revealed,setRevealed]=useState(false),[notice,setNotice]=useState('');
 const [filters,setFilters]=useState({search:'',category:'',collection:'',status:''}),[page,setPage]=useState(1);
 const progress=saved.progress||{};
 useEffect(()=>{let canceled=false;(async()=>{try{
  const response=await fetch(`${BASE}data/catalog.json`,{signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('题库目录加载失败');
  const c=await response.json();if(!Array.isArray(c.banks)||!c.banks.length)throw Error('题库目录格式有误');
  if(canceled)return;setCatalog(c);setBankLoad({done:0,total:c.banks.length});
  const chunks=[];
  const results=await loadQuestionBanks(c.banks,BASE,(qs,index)=>{if(canceled)return;chunks[index]=qs;setQuestions(chunks.flat());setLoading(false);setBankLoad(v=>({...v,done:v.done+1}));});
  if(canceled)return;
  const failed=results.filter(r=>r.status==='rejected');
  if(failed.length===results.length)throw Error('题库下载失败或超时，请检查网络后重新加载。');
  if(failed.length)setLoadWarning(`${failed.length} 个题库未能加载，已加载的题目仍可练习。请重新加载以重试。`);
 }catch(e){if(!canceled)setError(e.name==='TimeoutError'?'题库连接超时，请重新加载。':e.message);}finally{if(!canceled)setLoading(false);}})();return()=>{canceled=true;};},[]);
 useEffect(()=>{try{localStorage.setItem(KEY,JSON.stringify({...saved,activeId}));setStorageError('');}catch{setStorageError('浏览器未能保存进度；请勿关闭当前页面。');}},[saved,activeId]);
 const filtered=filterQuestions(questions,filters,progress),pages=Math.max(1,Math.ceil(filtered.length/12));
 const active=questions.find(q=>q.id===activeId),record=progress[activeId]||{};
 function updateRecord(patch){setSaved(s=>({...s,progress:{...(s.progress||{}),[activeId]:{...(s.progress?.[activeId]||{}),...patch}}}));}
 function start(q,preserveQueue=false){if(!q)return;if(!preserveQueue)setSaved(s=>({...s,queueIds:(filtered.some(item=>item.id===q.id)?filtered:questions).map(item=>item.id)}));setActiveId(q.id);setRevealed(false);setNotice('');setView('learn');window.scrollTo(0,0);}
 function advance(){const ids=saved.queueIds||[];const queue=ids.includes(active.id)?ids.map(id=>questions.find(q=>q.id===id)).filter(Boolean):questions;const next=nextQuestion(queue,active.id);if(next)start(next,true);else setNotice('本轮题目已练完，可以返回题库挑选下一组。');}
 function changeFilter(key,value){setFilters(f=>({...f,[key]:value}));setPage(1);}
 const categories=[...new Set(questions.map(q=>q.category).filter(Boolean))],collections=[...new Set(questions.flatMap(q=>q.collections||[q.collection]).filter(Boolean))];
 const mastered=questions.filter(q=>progress[q.id]?.status==='mastered').length,review=questions.filter(q=>progress[q.id]?.status==='review').length;
 function showAnswer(){setRevealed(true);setNotice('');}
 return <><header><a className="brand" href="#" onClick={e=>{e.preventDefault();setView('library');}}>✦ 面试自习室 <small>GALGAME</small></a><nav><button className={view==='library'?'selected':''} onClick={()=>setView('library')}>题库</button><button disabled={!active} onClick={()=>{setView('learn');setRevealed(false);}}>继续学习</button></nav></header>
 <main>{loadWarning&&<p role="alert" className="warning">{loadWarning}<button onClick={()=>location.reload()}>重新加载</button></p>}{bankLoad.total>bankLoad.done&&!loadWarning&&!error&&<p role="status">已加载 {bankLoad.done} / {bankLoad.total} 个题库，题目会陆续显示。</p>}{storageError&&<p role="alert" className="warning">{storageError}</p>}{loading?<div className="empty">正在整理自习室的题目…</div>:error?<div className="empty" role="alert"><h1>题库暂时没有加载成功</h1><p>{error}</p><button onClick={()=>location.reload()}>重新加载</button></div>:view==='library'?<>
 <section className="hero"><div><p className="eyebrow">夜间自习室 · 和澄夏一起练习</p><h1>把答案说出来，<br/>再把它变成自己的。</h1><p>看题、查看完整答案，随时标记和复习。无需模型 Key，预置题库随时练习。</p><button className="primary" disabled={!questions.length} onClick={()=>start(active||filtered[0]||questions[0],!!active)}>{active?'接着上次的题目':'开始今晚的练习'} →</button></div><img src={`${BASE}assets/chengxia.svg`} alt="自习伙伴澄夏"/></section>
 <div className="stats"><span><b>{questions.filter(q=>q.collection!=='牛客外链索引').length}</b> 道题目 <small>另含 {questions.filter(q=>q.collection==='牛客外链索引').length} 条来源索引</small></span><span><b>{collections.length}</b> 个题库</span><span><b>{mastered}</b> 已掌握</span><span><b>{review}</b> 待复习</span></div>
 <section className="library"><div className="section-heading"><h2>全部题库</h2><span>{filtered.length} 条符合条件</span></div><div className="filters"><label className="search">搜索题目或答案<input value={filters.search} onChange={e=>changeFilter('search',e.target.value)} placeholder="例如：RAG、并发、项目经历"/></label><label>分类<select value={filters.category} onChange={e=>changeFilter('category',e.target.value)}><option value="">全部分类</option>{categories.map(c=><option key={c}>{c}</option>)}</select></label><label>题库<select value={filters.collection} onChange={e=>changeFilter('collection',e.target.value)}><option value="">全部题库</option>{collections.map(c=><option key={c}>{c}</option>)}</select></label><label>学习状态<select value={filters.status} onChange={e=>changeFilter('status',e.target.value)}><option value="">全部状态</option><option value="new">未标记</option><option value="review">待复习</option><option value="mastered">已掌握</option></select></label></div>
 {!filtered.length?<div className="empty">没有符合条件的题目。<button onClick={()=>{setFilters({search:'',category:'',collection:'',status:''});setPage(1);}}>清除筛选</button></div>:<div className="cards">{pageQuestions(filtered,Math.min(page,pages)).map(q=><button className="card" key={q.id} onClick={()=>start(q)}><span className="tag">{q.category||'面试练习'}{q.archived ? ' · 归档' : ''}</span><h3>{q.title}</h3><p>{q.collection}{q.section?` · ${q.section}`:''}</p><span className="card-bottom">{progress[q.id]?.status==='mastered'?'✓ 已掌握':progress[q.id]?.status==='review'?'↻ 待复习':'开始练习 →'}<small>{q.answerExternalOnly?'来源索引':q.answerMissing?'待补答案':'含参考答案'}</small></span></button>)}</div>}
 <div className="pagination"><button disabled={page<=1} onClick={()=>setPage(p=>p-1)}>上一页</button><span>{Math.min(page,pages)} / {pages}</span><button disabled={page>=pages} onClick={()=>setPage(p=>p+1)}>下一页</button></div></section></>:active?<>
 <div className="study-heading"><button onClick={()=>setView('library')}>← 返回题库</button><span>{active.category} · {questions.findIndex(q=>q.id===active.id)+1} / {questions.length}</span></div>
 <section className="scene"><img className="character" src={`${BASE}assets/chengxia.svg`} alt="澄夏"/><div className="dialog"><span className="speaker">澄夏</span><p>想一想这道题，再点开参考答案一起看看。</p><h1>{active.title}</h1></div></section>
 <section className="answer-panel">{notice&&<p role="status" className="warning">{notice}</p>}{!revealed&&<button className="primary desktop-answer" onClick={showAnswer}>看参考答案 ↓</button>}
 {revealed&&<div className="reference"><h2>参考答案</h2><p className="answer-origin">答案来源：{active.answerOrigin||'题库原始内容'} · 参考资料，请自行核实；整理答案不代表原作者回答或你的项目经历</p>{active.answerMissing?<p className="warning">原题库未提供答案。这道题保留原题，请结合来源补充，当前没有自动生成答案。</p>:active.answerExternalOnly?<p className="warning">原题库的答案位于外部页面，请打开来源阅读全文。</p>:<div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{a:({href,children})=>safeExternalUrl(href)?<a href={safeExternalUrl(href)} target="_blank" rel="noopener noreferrer">{children} ↗</a>:<span title="本地资源未随项目发布，请查看原始资料">{children}（本地资源，请查看来源）</span>,img:({alt})=><span>［图片：{alt||'请查看原始来源'}］</span>}}>{active.answerMarkdown||active.answerText||'原始资料中未发现可展示的答案。'}</ReactMarkdown></div>}<details><summary>怎么结合我的情况回答？</summary><p className="template">{personalTemplate(active)}</p><p>这是组织表达的模板，不代表你已经做过这些项目。</p></details><div className="status-actions"><span>由你自己判断：</span><button className={record.status==='review'?'selected':''} onClick={()=>updateRecord({status:'review'})}>↻ 待复习</button><button className={record.status==='mastered'?'selected':''} onClick={()=>updateRecord({status:'mastered'})}>✓ 已掌握</button><button className="primary" onClick={advance}>继续练习 →</button></div></div>}
 <div className="mobile-controls" aria-label="刷题操作">{revealed?<><button className={record.status==='review'?'selected':''} onClick={()=>updateRecord({status:'review'})}>待复习</button><button className={record.status==='mastered'?'selected':''} onClick={()=>updateRecord({status:'mastered'})}>已掌握</button></>:<button className="primary" onClick={showAnswer}>看参考答案</button>}<button onClick={advance}>{revealed?'下一题 →':'跳过此题 →'}</button></div><div className="provenance"><b>资料来源</b><p>{active.collection} · {active.section||'题库正文'}</p><p>许可证：{active.license||'原资料未标明'}</p>{safeExternalUrl(active.sourceUrl)?<a href={safeExternalUrl(active.sourceUrl)} target="_blank" rel="noopener noreferrer">打开原始来源 ↗</a>:<p>本地资料来源，详见项目题库清单。</p>}</div></section></>:<div className="empty">请选择一道题目开始练习。<button onClick={()=>setView('library')}>打开题库</button></div>}</main><footer>预置内容 · 无自动评分 · 进度仅存于此浏览器 · 参考答案不等于真实项目经历</footer></>;
}
createRoot(document.getElementById('root')).render(<App/>);
