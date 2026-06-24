const cheerio = require('cheerio');
fetch('https://everout.com/portland/events/teriyakimotos-spamzilla/e243673/', {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none'
  }
}).then(r => r.text()).then(html => {
  const $ = cheerio.load(html);
  const qa = {};
  $('.answer-list > div').each((i, el) => {
    const key = $(el).find('div').first().text().trim();
    const val = $(el).find('div').last().text().trim();
    if (key && val) qa[key] = val;
  });
  console.log(qa);
}).catch(console.error);
