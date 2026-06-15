const fs = require('fs');

async function scrapeDescriptions() {
  const files = ['data/nachoweek2026.js', 'data/pizzaweek2026.js', 'data/highballweek2026.js'];

  for (const file of files) {
    console.log(`Processing ${file}...`);
    let content = fs.readFileSync(file, 'utf8');
    
    // Extract the JSON array string from the JS file
    const startStr = 'const newItems = [';
    const startIdx = content.indexOf(startStr) + startStr.length - 1;
    const endIdx = content.lastIndexOf(']') + 1;
    const jsonStr = content.substring(startIdx, endIdx);
    let restaurants = [];
    try {
      restaurants = JSON.parse(jsonStr);
    } catch (e) {
      console.error(`Error parsing JSON in ${file}: ${e.message}`);
      continue;
    }

    let updatedCount = 0;

    for (const r of restaurants) {
      if (r.url && r.url.includes('everout.com')) {
        try {
          const res = await fetch(r.url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          const html = await res.text();
          
          const match1 = html.match(/What(?:&#39;|')s on [Ii]t:?.*?<\/div>\s*<div[^>]*>(.*?)<\/div>/i) || html.match(/What(?:&#39;|')s on [Tt]hem:?.*?<\/div>\s*<div[^>]*>(.*?)<\/div>/i) || html.match(/What&#x27;s on [Tt]hem.*?<\/div>\s*<div[^>]*>(.*?)<\/div>/i);
          const match2 = html.match(/What [Tt]hey [Ss]ay:?.*?<\/div>\s*<div[^>]*>(.*?)<\/div>/i);

          let updated = false;

          if (match1) {
            r.whatsOnIt = match1[1].trim().replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
            updated = true;
          }
          if (match2) {
            r.whatTheySay = match2[1].trim().replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&quot;/g, '"');
            updated = true;
          }
          
          if (updated) {
            updatedCount++;
            process.stdout.write('.');
          } else {
            process.stdout.write('x');
          }
          
          // small delay to be polite
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (e) {
          console.error(`Failed to fetch ${r.url}:`, e);
        }
      }
    }

    console.log(); // newline
    if (updatedCount > 0) {
      const newJsonStr = JSON.stringify(restaurants, null, 2);
      const newContent = content.substring(0, startIdx) + newJsonStr + content.substring(endIdx);
      fs.writeFileSync(file, newContent);
      console.log(`Updated ${updatedCount} items in ${file}`);
    }
  }
}

scrapeDescriptions().then(() => console.log('Done!')).catch(console.error);
