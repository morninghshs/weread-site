const https = require('https');
const fs = require('fs');
const path = require('path');

const API_KEY = 'wrk-FAezgfEkSVOCgnbDQIzNGwAA';
const GATEWAY = 'https://i.weread.qq.com/api/agent/gateway';
const DATA_DIR = '/home/node/.openclaw/workspace/weread-data';

function post(apiName, body = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ api_name: apiName, skill_version: '1.0.3', ...body });
    const url = new URL(GATEWAY);
    const opts = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error(`JSON parse error: ${data.slice(0, 200)}`)); }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchAllNotebooks() {
  console.log('Fetching all notebooks...');
  let allBooks = [];
  let hasMore = true;
  let lastSort = 0;
  let page = 0;

  while (hasMore) {
    page++;
    const params = { count: 100 };
    if (lastSort) params.lastSort = lastSort;
    const data = await post('/user/notebooks', params);
    console.log(`  Page ${page}: got ${data.books?.length || 0} books`);
    if (data.books) allBooks.push(...data.books);
    hasMore = data.hasMore === 1;
    if (hasMore && data.books?.length > 0) {
      lastSort = data.books[data.books.length - 1].sort;
    }
    await sleep(300);
    if (page > 20) break; // safety
  }

  console.log(`  Total: ${allBooks.length} books with notes`);
  return allBooks;
}

async function fetchBookReviews(bookId, bookTitle) {
  console.log(`  Fetching reviews for: ${bookTitle} (${bookId})`);
  let allReviews = [];
  let hasMore = true;
  let synckey = 0;
  let page = 0;

  while (hasMore) {
    page++;
    const params = { bookid: bookId, count: 100 };
    if (synckey) params.synckey = synckey;
    const data = await post('/review/list/mine', params);
    if (data.reviews) allReviews.push(...data.reviews);
    hasMore = data.hasMore === 1;
    if (hasMore) synckey = data.synckey;
    await sleep(200);
    if (page > 20) break;
  }

  console.log(`    Got ${allReviews.length} reviews`);
  return allReviews.map(r => ({
    reviewId: r.review?.reviewId,
    content: r.review?.content,
    htmlContent: r.review?.htmlContent,
    star: r.review?.star,
    chapterName: r.review?.chapterName,
    isFinish: r.review?.isFinish,
    createTime: r.review?.createTime,
    range: r.review?.range,
    abstract: r.review?.abstract,
  }));
}

async function fetchBookmarks(bookId, bookTitle) {
  console.log(`  Fetching bookmarks for: ${bookTitle} (${bookId})`);
  try {
    const data = await post('/book/bookmarklist', { bookId });
    const bookmarks = data.updated || [];
    console.log(`    Got ${bookmarks.length} bookmarks`);
    return bookmarks.map(b => ({
      bookmarkId: b.bookmarkId,
      markText: b.markText,
      chapterUid: b.chapterUid,
      createTime: b.createTime,
      range: b.range,
      colorStyle: b.colorStyle,
    }));
  } catch (e) {
    console.log(`    Error: ${e.message}`);
    return [];
  }
}

async function fetchBookInfo(bookId) {
  try {
    return await post('/book/info', { bookId });
  } catch (e) {
    return null;
  }
}

async function fetchReadData() {
  console.log('Fetching reading stats...');
  try {
    const data = await post('/readdata/detail', { mode: 'overall' });
    console.log(`  Got reading stats`);
    return data;
  } catch (e) {
    console.log(`  Error: ${e.message}`);
    return null;
  }
}

async function main() {
  // 1. Fetch reading stats
  const readData = await fetchReadData();

  // 2. Fetch all notebooks
  const books = await fetchAllNotebooks();

  // 3. For each book with reviews, fetch detailed data
  const booksWithReviews = books.filter(b => (b.reviewCount || 0) > 0);
  console.log(`\nBooks with reviews: ${booksWithReviews.length}`);

  const detailedBooks = [];
  for (let i = 0; i < booksWithReviews.length; i++) {
    const book = booksWithReviews[i];
    const [reviews, bookmarks] = await Promise.all([
      fetchBookReviews(book.bookId, book.book?.title),
      fetchBookmarks(book.bookId, book.book?.title),
    ]);

    detailedBooks.push({
      bookId: book.bookId,
      title: book.book?.title,
      author: book.book?.author,
      cover: book.book?.cover,
      reviewCount: book.reviewCount,
      noteCount: book.noteCount,
      bookmarkCount: book.bookmarkCount,
      readingProgress: book.readingProgress,
      markedStatus: book.markedStatus,
      reviews: reviews,
      bookmarks: bookmarks,
    });

    console.log(`  Progress: ${i + 1}/${booksWithReviews.length}`);
    await sleep(200);
  }

  // Also include books with only bookmarks (no reviews) for completeness
  const booksNoReviews = books.filter(b => (b.reviewCount || 0) === 0);
  for (const book of booksNoReviews) {
    detailedBooks.push({
      bookId: book.bookId,
      title: book.book?.title,
      author: book.book?.author,
      cover: book.book?.cover,
      reviewCount: book.reviewCount,
      noteCount: book.noteCount,
      bookmarkCount: book.bookmarkCount,
      readingProgress: book.readingProgress,
      markedStatus: book.markedStatus,
      reviews: [],
      bookmarks: [],
    });
  }

  // 4. Compile all data
  const allData = {
    readData: readData,
    books: detailedBooks,
    totalBooks: detailedBooks.length,
    totalReviews: detailedBooks.reduce((s, b) => s + (b.reviews?.length || 0), 0),
    totalBookmarks: detailedBooks.reduce((s, b) => s + (b.bookmarks?.length || 0), 0),
    exportedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(DATA_DIR, 'all-data.json'), JSON.stringify(allData, null, 2));
  console.log(`\nDone!`);
  console.log(`  Total books: ${allData.totalBooks}`);
  console.log(`  Total reviews/想法: ${allData.totalReviews}`);
  console.log(`  Total bookmarks/划线: ${allData.totalBookmarks}`);
  console.log(`  Data file: ${path.join(DATA_DIR, 'all-data.json')}`);
  console.log(`  File size: ${(fs.statSync(path.join(DATA_DIR, 'all-data.json')).size / 1024 / 1024).toFixed(2)} MB`);
}

main().catch(e => { console.error(e); process.exit(1); });
