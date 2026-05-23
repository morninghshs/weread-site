const fs = require('fs');
const path = require('path');

const data = JSON.parse(fs.readFileSync('/home/node/.openclaw/workspace/weread-data/all-data.json', 'utf-8'));

// Helper: format seconds to xh ym
function fmtTime(s) {
  if (!s) return '0分钟';
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}小时${m}分钟`;
  return `${m}分钟`;
}

// Helper: format timestamp
function fmtDate(ts) {
  if (!ts) return '';
  const d = new Date(ts * 1000);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Helper: star display
function starHTML(star) {
  if (!star || star === -1 || star === 0) return '';
  const s = star >= 100 ? 5 : star >= 80 ? 4 : star >= 60 ? 3 : star >= 40 ? 2 : 1;
  return '★'.repeat(s) + '☆'.repeat(5-s);
}

// Helper: generate insight hint based on content
function genHint(content) {
  if (!content || content.length < 10) return '';
  const hints = [
    '💡 延伸思考：这个观点如何应用到你当下的生活中？',
    '💡 延伸思考：如果反过来想，会得出什么结论？',
    '💡 延伸思考：这个洞察能否解释你最近观察到的某个现象？',
    '💡 延伸思考：试着用一句话向朋友复述这个想法。',
    '💡 延伸思考：这个道理在你人生的哪个阶段会有不同的理解？',
    '💡 延伸思考：如果这是真的，你需要改变什么行为？',
    '💡 延伸思考：这和你的直觉反应一致吗？为什么？',
    '💡 延伸思考：你能想到一个反例吗？',
  ];
  // Deterministic but varied hint
  let hash = 0;
  for (let i = 0; i < content.length; i++) hash = ((hash << 5) - hash + content.charCodeAt(i)) | 0;
  return hints[Math.abs(hash) % hints.length];
}

// Reading stats
const rd = data.readData || {};
const totalReadDays = rd.readDays || 0;
const totalReadTime = rd.totalReadTime || 0;
const readStat = (rd.readStat || []).find(s => s.stat === '读过') || rd.readStat?.[0];
const readDoneStat = (rd.readStat || []).find(s => s.stat === '读完');
const noteStat = (rd.readStat || []).find(s => s.stat === '笔记');
const preferCategories = rd.preferCategory || [];
const preferAuthors = rd.preferAuthor || [];
const preferTime = rd.preferTime || [];

// Build time distribution chart data (6am to 5am)
const timeLabels = [];
for (let i = 6; i < 30; i++) timeLabels.push(i % 24);
const maxTime = Math.max(...preferTime, 1);
const timeBars = timeLabels.map((h, i) => ({
  hour: h,
  value: preferTime[i] || 0,
  pct: ((preferTime[i] || 0) / maxTime * 100).toFixed(1),
}));

// Books with content sorted by review count desc
const booksWithContent = data.books
  .filter(b => (b.reviews?.length || 0) + (b.bookmarks?.length || 0) > 0)
  .sort((a, b) => (b.reviews?.length || 0) - (a.reviews?.length || 0));

// Build category stats
const catMap = {};
data.books.forEach(b => {
  // Use reviews count as weight
  const cnt = (b.reviews?.length || 0) + (b.bookmarks?.length || 0);
  if (cnt > 0) catMap[b.title] = cnt;
});

// Escape HTML
function esc(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// Generate book cards HTML
let bookCardsHTML = '';
booksWithContent.forEach((book, idx) => {
  const totalNotes = (book.reviews?.length || 0) + (book.bookmarks?.length || 0) + (book.noteCount || 0);
  const progress = book.readingProgress || 0;
  const finished = book.markedStatus === 2 || progress >= 100;
  const cover = book.cover || '';
  const reviewCount = book.reviews?.length || 0;
  const bmCount = book.bookmarks?.length || 0;

  // Build reviews detail
  let reviewsHTML = '';
  if (book.reviews?.length > 0) {
    // Group by chapter if possible
    const chapterGroups = {};
    const noChapter = [];
    book.reviews.forEach(r => {
      if (r.chapterName) {
        if (!chapterGroups[r.chapterName]) chapterGroups[r.chapterName] = [];
        chapterGroups[r.chapterName].push(r);
      } else {
        noChapter.push(r);
      }
    });

    if (Object.keys(chapterGroups).length > 0) {
      for (const [ch, reviews] of Object.entries(chapterGroups)) {
        reviewsHTML += `<div class="chapter-group"><div class="chapter-title">📖 ${esc(ch)}</div>`;
        reviews.forEach(r => {
          reviewsHTML += buildReviewItem(r);
        });
        reviewsHTML += `</div>`;
      }
    }
    if (noChapter.length > 0) {
      reviewsHTML += `<div class="chapter-group"><div class="chapter-title">📝 其他想法</div>`;
      noChapter.forEach(r => {
        reviewsHTML += buildReviewItem(r);
      });
      reviewsHTML += `</div>`;
    }
  }

  // Bookmarks
  let bmHTML = '';
  if (book.bookmarks?.length > 0) {
    bmHTML += `<div class="chapter-group"><div class="chapter-title">🔖 划线摘录</div>`;
    book.bookmarks.forEach(b => {
      if (b.markText) {
        bmHTML += `<div class="review-item"><div class="bookmark-text"><span class="quote-mark">"</span>${esc(b.markText)}<span class="quote-mark">"</span></div>`;
        if (b.createTime) bmHTML += `<div class="review-time">${fmtDate(b.createTime)}</div>`;
        bmHTML += `</div>`;
      }
    });
    bmHTML += `</div>`;
  }

  bookCardsHTML += `
    <div class="book-card" data-idx="${idx}" onclick="toggleBook(this)">
      <div class="book-card-inner">
        ${cover ? `<div class="book-cover"><img src="${esc(cover)}" alt="${esc(book.title)}" loading="lazy"></div>` : '<div class="book-cover no-cover">📚</div>'}
        <div class="book-info">
          <h3 class="book-title">${esc(book.title)}</h3>
          <div class="book-author">${esc(book.author || '')}</div>
          <div class="book-meta">
            <span class="meta-tag">想法 ${reviewCount}</span>
            <span class="meta-tag">划线 ${bmCount}</span>
            ${finished ? '<span class="meta-tag tag-done">已读完</span>' : progress > 0 ? `<span class="meta-tag tag-reading">${progress}%</span>` : ''}
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(progress, 100)}%"></div></div>
        </div>
        <div class="expand-icon">▼</div>
      </div>
      <div class="book-detail" style="display:none">
        ${reviewsHTML}
        ${bmHTML}
      </div>
    </div>`;
});

function buildReviewItem(r) {
  let html = '<div class="review-item">';
  // Abstract/quoted text if exists
  if (r.abstract) {
    html += `<div class="review-quote">"${esc(r.abstract)}"</div>`;
  }
  // Content
  if (r.content) {
    html += `<div class="review-content">${esc(r.content)}</div>`;
    html += `<div class="review-hint">${genHint(r.content)}</div>`;
  }
  // Meta
  const meta = [];
  if (r.star && r.star > 0) meta.push(starHTML(r.star));
  if (r.isFinish) meta.push('📖 已读完');
  if (r.createTime) meta.push(fmtDate(r.createTime));
  if (meta.length) html += `<div class="review-meta">${meta.join(' · ')}</div>`;
  html += '</div>';
  return html;
}

// Reading time chart HTML
let timeChartHTML = '';
timeBars.forEach(t => {
  timeChartHTML += `<div class="time-bar-wrap"><div class="time-bar" style="height:${Math.max(parseFloat(t.pct), 2)}%" title="${t.hour}:00 - ${(t.value/3600).toFixed(1)}h"></div><div class="time-label">${t.hour}</div></div>`;
});

// Category tags HTML
let catTagsHTML = '';
preferCategories.slice(0, 12).forEach(c => {
  const size = 0.8 + (c.val || 0) * 0.6;
  catTagsHTML += `<span class="cat-tag" style="font-size:${size}rem">${esc(c.categoryTitle || c.parentCategoryTitle || '')}</span>`;
});

// Author list HTML
let authorHTML = '';
preferAuthors.slice(0, 10).forEach(a => {
  authorHTML += `<div class="author-item"><span class="author-name">${esc(a.name)}</span><span class="author-count">${a.count || 0}本</span></div>`;
});

// Stats from readStat
const statsHTML = rd.readStat?.map(s => `<div class="stat-item"><div class="stat-value">${esc(s.counts || '0')}</div><div class="stat-label">${esc(s.stat || '')}</div></div>`).join('') || '';

const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>我的阅读想法 — 微信读书</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@300;400;500;700&display=swap');

:root {
  --bg-primary: #0a0a0f;
  --bg-secondary: #12121a;
  --bg-card: #1a1a28;
  --bg-card-hover: #222236;
  --text-primary: #e8e6e3;
  --text-secondary: #9b97a0;
  --text-muted: #6b6773;
  --accent: #c4a35a;
  --accent-dim: rgba(196, 163, 90, 0.15);
  --accent-glow: rgba(196, 163, 90, 0.3);
  --border: rgba(255,255,255,0.06);
  --radius: 12px;
  --shadow: 0 4px 24px rgba(0,0,0,0.4);
}

* { margin: 0; padding: 0; box-sizing: border-box; }

html { scroll-behavior: smooth; }

body {
  font-family: 'Noto Sans SC', -apple-system, BlinkMacSystemFont, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  line-height: 1.7;
  min-height: 100vh;
}

/* ===== HERO ===== */
.hero {
  position: relative;
  padding: 80px 20px 60px;
  text-align: center;
  overflow: hidden;
}
.hero::before {
  content: '';
  position: absolute;
  top: -50%; left: -50%;
  width: 200%; height: 200%;
  background: radial-gradient(ellipse at 50% 0%, rgba(196,163,90,0.08) 0%, transparent 60%);
  pointer-events: none;
}
.hero-badge {
  display: inline-block;
  padding: 6px 18px;
  border: 1px solid var(--accent);
  border-radius: 20px;
  color: var(--accent);
  font-size: 0.85rem;
  letter-spacing: 2px;
  margin-bottom: 24px;
}
.hero h1 {
  font-family: 'Noto Serif SC', serif;
  font-size: clamp(2rem, 5vw, 3.2rem);
  font-weight: 700;
  margin-bottom: 8px;
  background: linear-gradient(135deg, #e8e6e3 30%, var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.hero-sub {
  color: var(--text-secondary);
  font-size: 1.05rem;
  margin-bottom: 40px;
}

/* Stats Grid */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 16px;
  max-width: 800px;
  margin: 0 auto 40px;
}
.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 20px 16px;
  text-align: center;
  transition: transform 0.3s, border-color 0.3s;
}
.stat-card:hover {
  transform: translateY(-2px);
  border-color: var(--accent-dim);
}
.stat-number {
  font-family: 'Noto Serif SC', serif;
  font-size: 2rem;
  font-weight: 700;
  color: var(--accent);
}
.stat-desc {
  font-size: 0.85rem;
  color: var(--text-secondary);
  margin-top: 4px;
}

/* Category tags */
.section { max-width: 960px; margin: 0 auto; padding: 40px 20px; }
.section-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 24px;
  padding-left: 14px;
  border-left: 3px solid var(--accent);
}
.cat-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}
.cat-tag {
  background: var(--accent-dim);
  color: var(--accent);
  padding: 6px 14px;
  border-radius: 16px;
  font-weight: 500;
  transition: transform 0.2s;
}
.cat-tag:hover { transform: scale(1.08); }

/* ReadStat */
.read-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  gap: 12px;
  margin-top: 20px;
}
.stat-item { text-align: center; padding: 12px; }
.stat-value { font-size: 1.4rem; font-weight: 700; color: var(--accent); }
.stat-label { font-size: 0.8rem; color: var(--text-secondary); margin-top: 4px; }

/* Time chart */
.time-chart-container {
  margin-top: 30px;
  padding: 24px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.time-chart-title { font-size: 1rem; color: var(--text-secondary); margin-bottom: 16px; }
.time-chart {
  display: flex;
  align-items: flex-end;
  gap: 4px;
  height: 120px;
}
.time-bar-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  justify-content: flex-end;
}
.time-bar {
  width: 100%;
  max-width: 28px;
  background: linear-gradient(to top, var(--accent), rgba(196,163,90,0.4));
  border-radius: 4px 4px 0 0;
  transition: opacity 0.2s;
  min-height: 2px;
}
.time-bar:hover { opacity: 0.8; }
.time-label {
  font-size: 0.65rem;
  color: var(--text-muted);
  margin-top: 6px;
}

/* Author list */
.author-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 16px;
}
.author-item {
  display: flex;
  justify-content: space-between;
  padding: 10px 16px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  font-size: 0.9rem;
}
.author-name { color: var(--text-primary); }
.author-count { color: var(--accent); font-weight: 600; }

/* Search & Filter */
.toolbar {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px 20px;
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.search-box {
  flex: 1;
  min-width: 200px;
  padding: 12px 18px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 0.95rem;
  outline: none;
  transition: border-color 0.3s;
}
.search-box::placeholder { color: var(--text-muted); }
.search-box:focus { border-color: var(--accent); }
.filter-btn {
  padding: 10px 18px;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 8px;
  color: var(--text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.3s;
}
.filter-btn:hover, .filter-btn.active {
  border-color: var(--accent);
  color: var(--accent);
}

/* Book cards */
.books-grid {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 20px 60px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.book-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  transition: border-color 0.3s, box-shadow 0.3s;
  cursor: pointer;
}
.book-card:hover {
  border-color: var(--accent-dim);
}
.book-card.open {
  border-color: var(--accent-glow);
  box-shadow: 0 0 30px rgba(196,163,90,0.08);
}
.book-card-inner {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 16px;
}
.book-cover {
  width: 56px;
  height: 78px;
  border-radius: 6px;
  overflow: hidden;
  flex-shrink: 0;
  background: var(--bg-secondary);
}
.book-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.book-cover.no-cover {
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.6rem;
}
.book-info { flex: 1; min-width: 0; }
.book-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 1.05rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.book-author {
  font-size: 0.8rem;
  color: var(--text-secondary);
  margin-top: 2px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.book-meta {
  display: flex;
  gap: 8px;
  margin-top: 6px;
  flex-wrap: wrap;
}
.meta-tag {
  font-size: 0.72rem;
  padding: 2px 8px;
  background: rgba(255,255,255,0.05);
  border-radius: 10px;
  color: var(--text-secondary);
}
.tag-done { background: rgba(76,175,80,0.15); color: #81c784; }
.tag-reading { background: rgba(66,165,245,0.15); color: #64b5f6; }
.progress-bar {
  height: 3px;
  background: rgba(255,255,255,0.06);
  border-radius: 2px;
  margin-top: 8px;
  overflow: hidden;
}
.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), rgba(196,163,90,0.6));
  border-radius: 2px;
  transition: width 0.6s ease;
}
.expand-icon {
  color: var(--text-muted);
  font-size: 0.8rem;
  transition: transform 0.3s;
  flex-shrink: 0;
}
.book-card.open .expand-icon { transform: rotate(180deg); }

/* Book detail */
.book-detail {
  padding: 0 16px 16px;
  border-top: 1px solid var(--border);
}
.chapter-group {
  margin-top: 16px;
}
.chapter-title {
  font-family: 'Noto Serif SC', serif;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--accent);
  padding: 8px 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
}
.review-item {
  padding: 12px 0;
  border-bottom: 1px solid rgba(255,255,255,0.03);
}
.review-item:last-child { border-bottom: none; }
.review-quote {
  font-family: 'Noto Serif SC', serif;
  font-style: italic;
  color: var(--text-secondary);
  padding: 8px 14px;
  border-left: 2px solid var(--accent-dim);
  margin-bottom: 8px;
  font-size: 0.9rem;
  line-height: 1.8;
}
.review-content {
  font-size: 0.95rem;
  line-height: 1.8;
  color: var(--text-primary);
}
.review-hint {
  font-size: 0.8rem;
  color: var(--text-muted);
  margin-top: 8px;
  padding: 6px 10px;
  background: rgba(196,163,90,0.06);
  border-radius: 6px;
}
.review-meta {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 6px;
}
.bookmark-text {
  font-family: 'Noto Serif SC', serif;
  color: var(--text-secondary);
  padding: 10px 14px;
  border-left: 2px solid rgba(100,181,246,0.3);
  font-size: 0.9rem;
  line-height: 1.8;
}
.quote-mark { color: var(--accent); font-size: 1.1em; }
.review-time {
  font-size: 0.75rem;
  color: var(--text-muted);
  margin-top: 6px;
}

/* Footer */
.footer {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-muted);
  font-size: 0.8rem;
  border-top: 1px solid var(--border);
  max-width: 960px;
  margin: 0 auto;
}

/* Responsive */
@media (max-width: 640px) {
  .hero { padding: 50px 16px 40px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); gap: 10px; }
  .book-card-inner { padding: 12px; gap: 12px; }
  .book-cover { width: 44px; height: 62px; }
  .time-bar { max-width: 16px; }
  .author-grid { grid-template-columns: 1fr; }
}

/* Animations */
@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-in {
  animation: fadeInUp 0.5s ease forwards;
  opacity: 0;
}
</style>
</head>
<body>

<!-- Hero -->
<section class="hero">
  <div class="hero-badge">WE READ · 想法集</div>
  <h1>我的阅读想法</h1>
  <p class="hero-sub">${totalReadDays} 天的阅读旅程，${fmtTime(totalReadTime)}的沉浸时光</p>
  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-number">${totalReadDays}</div>
      <div class="stat-desc">阅读天数</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${fmtTime(totalReadTime)}</div>
      <div class="stat-desc">累计阅读</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${data.totalBooks}</div>
      <div class="stat-desc">记录书籍</div>
    </div>
    <div class="stat-card">
      <div class="stat-number">${data.totalReviews}</div>
      <div class="stat-desc">想法/点评</div>
    </div>
  </div>
  ${statsHTML ? `<div class="read-stat-grid">${statsHTML}</div>` : ''}
</section>

<!-- Reading Insights -->
<section class="section">
  <h2 class="section-title">阅读画像</h2>
  ${catTagsHTML ? `<div class="cat-cloud">${catTagsHTML}</div>` : ''}
  
  <div class="time-chart-container">
    <div class="time-chart-title">🕐 阅读时段分布（24h）</div>
    <div class="time-chart">${timeChartHTML}</div>
  </div>

  ${authorHTML ? `
  <div style="margin-top:30px">
    <h3 style="font-size:1.1rem; color:var(--text-secondary); margin-bottom:16px;">✍️ 偏好作者</h3>
    <div class="author-grid">${authorHTML}</div>
  </div>` : ''}
</section>

<!-- Toolbar -->
<div class="toolbar">
  <input type="text" class="search-box" placeholder="搜索书名、作者或想法内容…" oninput="filterBooks()">
  <button class="filter-btn active" onclick="setSortMode(this,'reviews')">最多想法</button>
  <button class="filter-btn" onclick="setSortMode(this,'progress')">阅读进度</button>
  <button class="filter-btn" onclick="setSortMode(this,'recent')">最近活跃</button>
</div>

<!-- Books -->
<div class="books-grid" id="booksGrid">
  ${bookCardsHTML}
</div>

<!-- Footer -->
<div class="footer">
  <p>数据来自微信读书 · 共 ${data.totalBooks} 本书 · ${data.totalReviews} 条想法 · ${data.totalBookmarks} 条划线</p>
  <p style="margin-top:8px">Generated at ${data.exportedAt?.slice(0,10) || 'today'}</p>
</div>

<script>
// Toggle book detail
function toggleBook(el) {
  const detail = el.querySelector('.book-detail');
  const isOpen = el.classList.contains('open');
  // Close all others
  document.querySelectorAll('.book-card.open').forEach(c => {
    c.classList.remove('open');
    c.querySelector('.book-detail').style.display = 'none';
  });
  if (!isOpen) {
    el.classList.add('open');
    detail.style.display = 'block';
    setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 100);
  }
}

// Search/filter
function filterBooks() {
  const q = document.querySelector('.search-box').value.toLowerCase();
  document.querySelectorAll('.book-card').forEach(card => {
    const text = card.textContent.toLowerCase();
    card.style.display = text.includes(q) ? '' : 'none';
  });
}

// Sort
let currentSort = 'reviews';
function setSortMode(btn, mode) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentSort = mode;
  const grid = document.getElementById('booksGrid');
  const cards = Array.from(grid.querySelectorAll('.book-card'));
  cards.sort((a, b) => {
    if (mode === 'reviews') {
      return parseInt(b.querySelector('.meta-tag')?.textContent || '0') - parseInt(a.querySelector('.meta-tag')?.textContent || '0');
    }
    return 0;
  });
  cards.forEach(c => grid.appendChild(c));
}

// Scroll animation
const observer = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('animate-in');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });
document.querySelectorAll('.book-card').forEach(c => observer.observe(c));
</script>
</body>
</html>`;

const outPath = '/home/node/.openclaw/workspace/weread-website/index.html';
fs.writeFileSync(outPath, html);
const size = fs.statSync(outPath).size;
console.log(`Website generated: ${outPath}`);
console.log(`Size: ${(size / 1024).toFixed(1)} KB`);
console.log(`Books: ${data.totalBooks}, Reviews: ${data.totalReviews}, Bookmarks: ${data.totalBookmarks}`);
