var fs = require('fs');
var data = JSON.parse(fs.readFileSync('/home/node/.openclaw/workspace/weread-data/all-data.json', 'utf-8'));

function fmtTime(s) { if(!s) return '0分钟'; var h=Math.floor(s/3600),m=Math.floor((s%3600)/60); return h>0?h+'小时'+m+'分钟':m+'分钟'; }
function fmtDate(ts) { if(!ts) return ''; var d=new Date(ts*1000); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function starHtml(star) { if(!star||star<=0) return ''; var s=star>=100?5:star>=80?4:star>=60?3:star>=40?2:1; return '★'.repeat(s)+'☆'.repeat(5-s); }
function repeatStr(c,n){ var r=''; for(var i=0;i<n;i++) r+=c; return r; }

var HINTS = [
  '💡 这个观点如何应用到你当下的生活中？',
  '💡 如果反过来想，会得出什么结论？',
  '💡 这个洞察能否解释你最近观察到的某个现象？',
  '💡 试着用一句话向朋友复述这个想法。',
  '💡 这个道理在你人生的哪个阶段会有不同的理解？',
  '💡 如果这是真的，你需要改变什么行为？',
  '💡 这和你的直觉反应一致吗？为什么？',
  '💡 你能想到一个反例吗？',
];

var rd = data.readData || {};
var rdStats = rd.readStat || [];
var readDays = rd.readDays || 0;
var totalReadTime = rd.totalReadTime || 0;
var preferCategories = rd.preferCategory || [];
var preferAuthors = rd.preferAuthor || [];
var preferTime = rd.preferTime || [];

var maxTime = Math.max.apply(null, preferTime.length ? preferTime : [1]);
var timeBars = '';
preferTime.forEach(function(v,i) {
  var hour = (6+i)%24;
  var pct = Math.max((v/maxTime*100),1);
  timeBars += '<div class=tc><div class=bar style="height:'+pct+'%" title="'+hour+':00"></div><div class=lbl>'+hour+'</div></div>';
});

var catTags = '';
preferCategories.slice(0,12).forEach(function(c) {
  catTags += '<span class=tag>'+esc(c.categoryTitle||c.parentCategoryTitle||'')+'</span>';
});

var authorHTML = '';
preferAuthors.slice(0,12).forEach(function(a) {
  authorHTML += '<div class=au-row><span class=n>'+esc(a.name)+'</span><span class=c>'+(a.count||0)+'本</span></div>';
});

var statCards = '';
rdStats.forEach(function(s) {
  statCards += '<div style="text-align:center;padding:10px;background:var(--bg2);border:1px solid var(--border);border-radius:8px"><div style="font-size:1.1rem;font-weight:700;color:var(--accent)">'+esc(s.counts||'')+'</div><div style="font-size:0.65rem;color:var(--text3);margin-top:2px">'+esc(s.stat||'')+'</div></div>';
});

var recentReviews = [];
data.books.forEach(function(b) {
  (b.reviews||[]).forEach(function(r) {
    if(r.createTime) recentReviews.push({content:r.content,abstract:r.abstract,createTime:r.createTime,chapterName:r.chapterName,star:r.star,bookTitle:b.title,bookCover:b.cover});
  });
});
recentReviews.sort(function(a,b){ return (b.createTime||0)-(a.createTime||0); });
var recent10 = recentReviews.slice(0,10);

var recentHTML = '';
recent10.forEach(function(r) {
  var hash = (r.content||'').split('').reduce(function(h,c){ return ((h<<5)-h+c.charCodeAt(0))|0; },0);
  var hint = HINTS[Math.abs(hash)%HINTS.length];
  recentHTML += '<div class=tl-item><div class=tl-book>'+(r.bookCover?'<img src="'+esc(r.bookCover)+'">':'📚')+'</div><div class=tl-content><div class=tl-book-title>📖 '+esc(r.bookTitle||'')+'</div>';
  if(r.abstract) recentHTML += '<div class=rev-quote style="margin-bottom:5px">'+esc(r.abstract)+'</div>';
  if(r.content) recentHTML += '<div class=tl-text>'+esc(r.content)+'</div><div class=tl-hint>'+hint+'</div>';
  if(r.createTime) recentHTML += '<div class=tl-time>'+fmtDate(r.createTime)+'</div>';
  recentHTML += '</div></div>';
});

var booksJSON = JSON.stringify(data.books);
var hintsJSON = JSON.stringify(HINTS);

// Read CSS from existing file
var existingCss = '';
try {
  var existingHTML = fs.readFileSync('/home/node/.openclaw/workspace/weread-website/index.html','utf-8');
  var m = existingHTML.match(/<style>([\s\S]*?)<\/style>/);
  if(m) existingCss = m[1];
} catch(e) {}

var html = [
'<!DOCTYPE html>\n<html lang=zh-CN>\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width,initial-scale=1.0">\n<title>阅读宇宙 \u2014 微信读书</title>\n<style>\n' + existingCss + '\n</style>\n</head>\n<body>\n\n<button class=hamburger onclick=toggleSidebar()>☰</button>\n<div class=overlay onclick=toggleSidebar()></div>\n\n<div class=app>\n  <aside class=sidebar id=sidebar>\n    <div class=sidebar-top>\n      <div class=brand><span class=brand-icon>📚</span><div><div>阅读宇宙</div><div class=brand-sub>微信读书</div></div></div>\n      <div class=quick-stats>\n        <div class=qs><div class=v>' + readDays + '</div><div class=l>天</div></div>\n        <div class=qs><div class=v>' + data.totalBooks + '</div><div class=l>书</div></div>\n        <div class=qs><div class=v>' + data.totalReviews + '</div><div class=l>想法</div></div>\n        <div class=qs><div class=v>' + data.totalBookmarks + '</div><div class=l>划线</div></div>\n      </div>\n    </div>\n    <div class=search-wrap>\n      <span class=si-icon>🔍</span>\n      <input class=si placeholder="搜索书名或作者…" oninput=onSearch(this.value)>\n    </div>\n    <div class=sort-bar>\n      <button class="sb on" onclick=setSort("reviews",this)>想法数</button>\n      <button class=sb onclick=setSort("progress",this)>阅读进度</button>\n      <button class=sb onclick=setSort("recent",this)>最近活跃</button>\n    </div>\n    <div class=book-list id=bookList></div>\n  </aside>\n  <main class=main id=mainArea>\n    <div class=overview id=ov>\n      <div class=ov-head>\n        <h1 class=ov-title>阅读宇宙</h1>\n        <p class=ov-sub>' + readDays + ' 天阅读旅程 · ' + fmtTime(totalReadTime) + ' 沉浸时光</p>\n      </div>\n      <div class=ov-grid>\n        <div class=ov-card><div class=n>' + readDays + '</div><div class=d>阅读天数</div></div>\n        <div class=ov-card><div class=n>' + fmtTime(totalReadTime) + '</div><div class=d>累计阅读</div></div>\n        <div class=ov-card><div class=n>' + data.totalBooks + '</div><div class=d>记录书籍</div></div>\n        <div class=ov-card><div class=n>' + data.totalReviews + '</div><div class=d>想法/点评</div></div>\n        <div class=ov-card><div class=n>' + data.totalBookmarks + '</div><div class=d>划线摘录</div></div>\n      </div>',
  (statCards ? '\n      <div class=ov-section><h2 class=ov-h>阅读统计</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(80px,1fr));gap:6px">' + statCards + '</div></div>' : ''),
  (catTags ? '\n      <div class=ov-section><h2 class=ov-h>偏好分类</h2><div class=tag-cloud>' + catTags + '</div></div>' : ''),
  '\n      <div class=ov-section><h2 class=ov-h>阅读时段</h2><div class=time-wrap><div class=time-title>🕐 24 小时阅读节奏（6:00 - 次日 5:00）</div><div class=time-bars>' + timeBars + '</div></div></div>',
  (authorHTML ? '\n      <div class=ov-section><h2 class=ov-h>偏好作者</h2><div class=au-grid>' + authorHTML + '</div></div>' : ''),
  (recentHTML ? '\n      <div class=ov-section><h2 class=ov-h>最近想法</h2>' + recentHTML + '</div>' : ''),
  '\n    </div>\n    <div class=book-detail id=bkDetail></div>\n  </main>\n</div>\n\n<div class=nav-bar>\n  <div class="nav-item on" onclick=goHome()>🏠 首页</div>\n  <div class=nav-item onclick=goHome()>📊 统计</div>\n  <div class=nav-item onclick=goHome()>📚 书架</div>\n  <div class=nav-item onclick=goHome()>💡 关于</div>\n</div>\n\n<script>\nvar BOOKS = ' + booksJSON + ';\nvar HINTS = ' + hintsJSON + ';\nvar curSort = "reviews";\nvar sel = -1;\nvar curTab = "reviews";\n\nfunction renderList() {\n  var el = document.getElementById("bookList");\n  var q = (document.querySelector(".si")||{value:""}).value.toLowerCase();\n  var arr = BOOKS.map(function(b,i){ return {b:b,i:i}; });\n  if(q) arr = arr.filter(function(x){ return (x.b.title||"").toLowerCase().indexOf(q)!==-1||(x.b.author||"").toLowerCase().indexOf(q)!==-1; });\n  if(curSort==="reviews") arr.sort(function(a,b){ return (b.b.reviews?b.b.reviews.length:0)-(a.b.reviews?a.b.reviews.length:0); });\n  else if(curSort==="progress") arr.sort(function(a,b){ return (b.b.readingProgress||0)-(a.b.readingProgress||0); });\n  else if(curSort==="recent") arr.sort(function(a,b){ return (b.b.sort||0)-(a.b.sort||0); });\n  if(!arr.length){ el.innerHTML=\'<div class=empty><div class=empty-icon>📭</div>没有找到匹配的书籍</div>\'; return; }\n  var html = "";\n  for(var i=0;i<arr.length;i++){\n    var b=arr[i].b;\n    var idx=arr[i].i;\n    var selCls=idx===sel?" sel":"";\n    var cov=b.cover?\'<img src="\'+esc(b.cover)+\'" loading=lazy alt="">\':"📚";\n    var rlen=b.reviews?b.reviews.length:0;\n    var blen=b.bookmarks?b.bookmarks.length:0;\n    html += \'<div class="bi\'+selCls+\'" onclick="selBook(\'+idx+\')">\'+\n      \'<div class=cov>\'+cov+\'</div>\'+\n      \'<div class=if><div class=ti>\'+esc(b.title||"")+\'</div><div class=ml><span class=mc>\'+rlen+\' 想法</span><span>\'+blen+\' 划线</span></div></div>\'+\n      \'<span class=ic>›</span></div>\';\n  }\n  el.innerHTML = html;\n}\n\nfunction selBook(idx) {\n  sel=idx; renderList();\n  var b = BOOKS[idx];\n  document.getElementById("ov").style.display="none";\n  var el = document.getElementById("bkDetail");\n  el.style.display="block";\n  var pg=b.readingProgress||0;\n  var done=b.markedStatus===2||pg>=100;\n  var rc=b.reviews?b.reviews.length:0;\n  var bc=b.bookmarks?b.bookmarks.length:0;\n  var cov=b.cover?\'<img src="\'+esc(b.cover)+\'" alt="">\':"📚";\n  var tags=\'<span class="bk-tag">💬 \'+rc+\' 想法</span><span class="bk-tag">🔖 \'+bc+\' 划线</span>\';\n  if(done) tags+=\'<span class="bk-tag done">✓ 已读完</span>\';\n  else if(pg>0) tags+=\'<span class="bk-tag reading">\'+pg+\'%</span>\';\n  el.innerHTML=\'<div class=bk-hdr>\'+\n    \'<div class=bk-cov>\'+cov+\'</div>\'+\n    \'<div class=bk-info>\'+\n      \'<div class=bk-title>\'+esc(b.title||"")+\'</div>\'+\n      \'<div class=bk-author>\'+esc(b.author||"")+\'</div>\'+\n      \'<div class=bk-meta>\'+tags+\'</div>\'+\n      \'<div class=bk-prog><div class=bk-prog-bar><div class=bk-prog-fill style="width:\'+Math.min(pg,100)+\'%"></div></div><div class=bk-prog-pct>\'+pg+\'%</div></div>\'+\n    \'</div></div>\'+\n    \'<div class=detail-tabs>\'+\n      \'<button class="dt on" id=tab-reviews onclick="showTab(\\\'reviews\\\')">💬 想法 (\'+rc+\')</button>\'+\n      (bc>0?\'<button class=dt id=tab-bookmarks onclick="showTab(\\\'bookmarks\\\')">🔖 划线 (\'+bc+\')</button>\':\'\')+\n    \'</div>\'+\n    \'<div id=content-reviews>\'+(rc>0?buildReviews(b.reviews||[]):\'<div class=empty><div class=empty-icon>💭</div>暂无想法</div>\')+\'</div>\'+\n    \'<div id=content-bookmarks style="display:none">\'+(bc>0?buildBookmarks(b.bookmarks||[]):\'<div class=empty><div class=empty-icon>📝</div>暂无划线</div>\')+\'</div>\';\n  document.getElementById("mainArea").scrollTop=0;\n  if(window.innerWidth<=768) toggleSidebar();\n}\n\nfunction buildReviews(reviews) {\n  var groups={},noCh=[];\n  for(var i=0;i<reviews.length;i++){\n    var r=reviews[i];\n    if(r.chapterName){ if(!groups[r.chapterName]) groups[r.chapterName]=[]; groups[r.chapterName].push(r); }\n    else noCh.push(r);\n  }\n  var html="";\n  for(var ch in groups){\n    html+=\'<div class=chapter-group><div class=chapter-title>📖 \'+esc(ch)+\'</div>\';\n    for(var j=0;j<groups[ch].length;j++) html+=buildRevItem(groups[ch][j]);\n    html+="</div>";\n  }\n  if(noCh.length){\n    html+=\'<div class=chapter-group><div class=chapter-title>📝 其他想法</div>\';\n    for(var k=0;k<noCh.length;k++) html+=buildRevItem(noCh[k]);\n    html+="</div>";\n  }\n  return html;\n}\n\nfunction buildRevItem(r) {\n  var h=\'<div class=rev-item>\';\n  if(r.abstract) h+=\'<div class=rev-quote>\'+esc(r.abstract)+\'</div>\';\n  if(r.content){\n    h+=\'<div class=rev-content>\'+esc(r.content)+\'</div>\';\n    var hash=0;\n    for(var i=0;i<r.content.length;i++) hash=((hash<<5)-hash+r.content.charCodeAt(i))|0;\n    h+=\'<div class=rev-hint>\'+HINTS[Math.abs(hash)%HINTS.length]+\'</div>\';\n  }\n  var meta=[];\n  if(r.star&&r.star>0) meta.push(starHtml(r.star));\n  if(r.createTime) meta.push(fmtDate(r.createTime));\n  if(meta.length) h+=\'<div class=rev-meta>\'+meta.join(" · ")+\'</div>\';\n  h+="</div>";\n  return h;\n}\n\nfunction buildBookmarks(bms) {\n  var html="";\n  for(var i=0;i<bms.length;i++){\n    var b=bms[i];\n    if(b.markText) html+=\'<div class=bm-item><div class=bm-text>\'+esc(b.markText)+\'</div>\'+(b.createTime?\'<div class=bm-time>\'+fmtDate(b.createTime)+\'</div>\':\'\')+\"</div>";\n  }\n  return html;\n}\n\nfunction showTab(tab){\n  curTab=tab;\n  document.querySelectorAll(".dt").forEach(function(d){ d.classList.remove("on"); });\n  document.getElementById("tab-"+tab).classList.add("on");\n  document.getElementById("content-reviews").style.display=tab==="reviews"?"":"none";\n  document.getElementById("content-bookmarks").style.display=tab==="bookmarks"?"":"none";\n}\n\nfunction setSort(mode,btn){\n  curSort=mode;\n  document.querySelectorAll(".sb").forEach(function(b){ b.classList.remove("on"); });\n  btn.classList.add("on");\n  renderList();\n}\n\nfunction onSearch(q){ renderList(); }\n\nfunction goHome(){\n  sel=-1; renderList();\n  document.getElementById("ov").style.display="";\n  document.getElementById("bkDetail").style.display="none";\n  document.getElementById("mainArea").scrollTop=0;\n}\n\nfunction toggleSidebar(){\n  document.getElementById("sidebar").classList.toggle("open");\n  document.querySelector(".overlay").classList.toggle("show");\n}\n\nfunction fmtDate(ts){ if(!ts) return ""; var d=new Date(ts*1000); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }\nrenderList();\n</script>\n</body>\n</html>'].join('');

var outPath = '/home/node/.openclaw/workspace/weread-website/index.html';
fs.writeFileSync(outPath, html);
console.log('OK: '+(fs.statSync(outPath).size/1024).toFixed(1)+' KB');