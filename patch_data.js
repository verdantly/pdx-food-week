import fs from 'fs';

async function run() {
  const file = 'data/nachoweek2026.js';
  const content = fs.readFileSync(file, 'utf8');
  
  const startStr = 'const newItems = [';
  const endStr = '];\n  newItems.forEach(';
  
  const startIndex = content.indexOf(startStr);
  const endIndex = content.indexOf(endStr);
  
  if (startIndex === -1 || endIndex === -1) {
    console.error('Could not find array boundaries');
    return;
  }
  
  const arrayStr = content.substring(startIndex + 'const newItems = '.length, endIndex + 1);
  const data = JSON.parse(arrayStr);
  
  for (const item of data) {
    if (!item.url) continue;
    try {
      const res = await fetch(item.url);
      const html = await res.text();
      
      const minorsMatch = html.match(/Minors allowed\?[^<]*<\/div>\s*<div[^>]*>\s*([a-zA-Z]+)/i);
      if (minorsMatch && minorsMatch[1].toLowerCase() === 'yes') {
        item.minors = true;
      } else {
        item.minors = false;
      }
      
      const takeoutMatch = html.match(/Takeout available\?[^<]*<\/div>\s*<div[^>]*>\s*([a-zA-Z]+)/i);
      if (takeoutMatch && takeoutMatch[1].toLowerCase() === 'yes') {
        item.takeout = true;
      } else {
        item.takeout = false;
      }
      
      console.log(item.dish, 'minors:', item.minors, 'takeout:', item.takeout);
      
    } catch (e) {
      console.error('Failed', item.url, e.message);
    }
  }
  
  const newContent = content.substring(0, startIndex + 'const newItems = '.length) + 
                     JSON.stringify(data, null, 2) + 
                     content.substring(endIndex + 1);
                     
  fs.writeFileSync(file, newContent, 'utf8');
  console.log('Done.');
}
run();
