var fs = require('fs');
var https = require('https');

var API_KEY = 'wrk-FAezgfEkSVOCgnbDQIzNGwAA';
var DATA_DIR = '/home/node/.openclaw/workspace/weread-data';
var OUT_FILE = 'all-data.json';

function post(apiName, body) {
  return new Promise(function(resolve, reject) {
    var payload = JSON.stringify({ api_name: apiName, skill_version: '1.0.3' });
    Object.keys(body || {}).forEach(function(k){ payload = JSON.stringify(JSON.parse(payload).concat ? payload : Object.assign(JSON.parse(payload), {[k]: body[k]})); });
    var p2 = JSON.stringify(Object.assign({ api_name: apiName, skill_version: '1.0.3' }, body));
    var url = new URL('https://i.weread.qq.com/api/agent/gateway');
    var opts = {
      hostname: url.hostname, path: url.pathname, method: 'POST',
      headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(p2) }
    };
    var req = https.request(opts, function(res) {
      var d = '';
      res.on('data', function(c){ d += c; });
      res.on('end', function(){ try { resolve(JSON.parse(d)); } catch(e) { reject(new Error(d.slice(0,100))); } });
    });
    req.on('error', reject);
    req.write(p2);
    req.end();
  });
}

function sleep(ms) { return new Promise(function(r){ setTimeout(r, ms); }); }

async function main() {
  var allBooks = [];
  var hasMore = true;
  var lastSort = 0;
  var page = 0;
  console.log('Fetching notebooks...');
  while (hasMore) {
    page++;
    var params = { count: 100 };
    if (lastSort) params.lastSort = lastSort;
    var data = await post('/user/notebooks', params);
    if (data.books) allBooks.push.apply(allBooks, data.books);
    hasMore = data.hasMore === 1;
    if (hasMore && data.books && data.books.length > 0) lastSort = data.books[data.books.length-1].sort;
    await sleep(300);
    if (page > 20) break;
  }
  console.log('Total books: ' + allBooks.length);

  var booksWithReviews = allBooks.filter(function(b){ return (b.reviewCount || 0) > 0; });
  console.log('Books with reviews: ' + booksWithReviews.length);

  var detailedBooks = [];
  for (var i = 0; i < booksWithReviews.length; i++) {
    var book = booksWithReviews[i];
    console.log('  ' + (i+1) + '/' + booksWithReviews.length + ': ' + (book.book && book.book.title));
    // fetch reviews
    var allReviews = [];
    var hasMore2 = true;
    var synckey = 0;
    while (hasMore2) {
      var params2 = { bookid: book.bookId, count: 100 };
      if (synckey) params2.synckey = synckey;
      var rd = await post('/review/list/mine', params2);
      if (rd.reviews) allReviews.push.apply(allReviews, rd.reviews);
      hasMore2 = rd.hasMore === 1;
      if (hasMore2) synckey = rd.synckey;
      await sleep(200);
    }
    // fetch bookmarks
    var bookmarks = [];
    try {
      var bdata = await post('/book/bookmarklist', { bookId: book.bookId });
      if (bdata.updated) bookmarks = bdata.updated;
    } catch(e) {}
    detailedBooks.push({
      bookId: book.bookId,
      title: book.book && book.book.title,
      author: book.book && book.book.author,
      cover: book.book && book.book.cover,
      reviewCount: book.reviewCount,
      noteCount: book.noteCount,
      bookmarkCount: book.bookmarkCount,
      readingProgress: book.readingProgress,
      markedStatus: book.markedStatus,
      sort: book.sort,
      reviews: allReviews.map(function(r){ return { reviewId: r.review && r.review.reviewId, content: r.review && r.review.content, chapterName: r.review && r.review.chapterName, star: r.review && r.review.star, createTime: r.review && r.review.createTime, abstract: r.review && r.review.abstract }; }),
      bookmarks: bookmarks.map(function(b){ return { bookmarkId: b.bookmarkId, markText: b.markText, chapterUid: b.chapterUid, createTime: b.createTime, range: b.range, colorStyle: b.colorStyle }; })
    });
    await sleep(200);
  }

  // Add books without reviews
  allBooks.filter(function(b){ return (b.reviewCount || 0) === 0; }).forEach(function(book) {
    detailedBooks.push({
      bookId: book.bookId, title: book.book && book.book.title,
      author: book.book && book.book.author, cover: book.book && book.book.cover,
      reviewCount: book.reviewCount, noteCount: book.noteCount, bookmarkCount: book.bookmarkCount,
      readingProgress: book.readingProgress, markedStatus: book.markedStatus, sort: book.sort,
      reviews: [], bookmarks: []
    });
  });

  // Fetch read stats
  var readData = null;
  try { readData = await post('/readdata/detail', { mode: 'overall' }); } catch(e) {}

  var allData = {
    readData: readData,
    books: detailedBooks,
    totalBooks: detailedBooks.length,
    totalReviews: detailedBooks.reduce(function(s,b){ return s+(b.reviews&&b.reviews.length||0); }, 0),
    totalBookmarks: detailedBooks.reduce(function(s,b){ return s+(b.bookmarks&&b.bookmarks.length||0); }, 0),
    exportedAt: new Date().toISOString()
  };

  fs.writeFileSync(OUT_FILE, JSON.stringify(allData, null, 2));
  console.log('Done! Written to ' + OUT_FILE);
}

main().catch(function(e){ console.error(e); process.exit(1); });
