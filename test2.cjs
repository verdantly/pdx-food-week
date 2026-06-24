const cheerio = require('cheerio');
async function run() {
  const res = await fetch('https://everout.com/portland/events/teriyakimotos-spamzilla/e243673/', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none'
    }
  });
  const html = await res.text();
  const $ = cheerio.load(html);
  const qa = {};
  .answer-list > div.each((i, el) => {
    const key = .find('div').first().text().trim();
    const val = .find('div').last().text().trim();
    if (key && val) qa[key] = val;
  });
  console.log(qa);
}
run();
