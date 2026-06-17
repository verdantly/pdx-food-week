const http = require('https');
const url = 'https://everout.com/portland/events/frozoni-tony-frozen-negroni/e245475/';
const req = http.request(url, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': 'none'
  }
}, res => {
  let html = '';
  res.on('data', d => html += d);
  res.on('end', () => {
    const matches = html.match(/<div[^>]*class=["'].*?answer-list.*?["'][^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/);
    if (matches) {
      const section = matches[1];
      const itemRegex = /<div class="mb-1">[\s\S]*?<div>(.*?)<\/div>[\s\S]*?<div>([\s\S]*?)<\/div>/g;
      for (const match of section.matchAll(itemRegex)) {
        console.log(match[1].trim() + ' : ' + match[2].trim().replace(/<[^>]+>/g, ''));
      }
    } else {
      console.log('Answer list not found');
    }
  });
});
req.on('error', console.error);
req.end();
