const fs = require('fs');
const path = require('path');

const dataFile = path.join(__dirname, '../data/tacoweek2026.js');
let dataContent = fs.readFileSync(dataFile, 'utf8');

const urlRegex = /"url":\s*"([^"]+)"/g;
const matches = [...dataContent.matchAll(urlRegex)];

async function scrape() {
  console.log(`Found ${matches.length} URLs to scrape.`);
  let updatedContent = dataContent;

  for (let i = 0; i < matches.length; i++) {
    const fullMatch = matches[i][0];
    const url = matches[i][1];

    if (updatedContent.includes(`"restaurantUrl":`) && updatedContent.substring(updatedContent.indexOf(fullMatch) - 150, updatedContent.indexOf(fullMatch)).includes('"restaurantUrl"')) {
      console.log(`[${i+1}/${matches.length}] Already scraped: ${url}`);
      continue;
    }

    try {
      console.log(`[${i+1}/${matches.length}] Fetching ${url}...`);
      const response = await fetch(url);
      const html = await response.text();

      const venueMatch = html.match(/<a href="([^"]+)"[^>]*>Venue website<\/a>/i);
      if (venueMatch) {
        const venueUrl = venueMatch[1];
        console.log(`  -> Found: ${venueUrl}`);
        const replacement = `"restaurantUrl": "${venueUrl}",\n    ${fullMatch}`;
        updatedContent = updatedContent.replace(fullMatch, replacement);
      } else {
        console.log(`  -> No venue website found`);
      }
      
      // Delay to be polite
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.error(`  -> Error fetching ${url}:`, e);
    }
  }

  fs.writeFileSync(dataFile, updatedContent, 'utf8');
  console.log('Done modifying tacoweek2026.js');
}

scrape();
