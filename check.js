import fs from 'fs';
async function run() {
  const html = await (await fetch('https://everout.com/portland/events/teriyakimotos-spamzilla/e243673/')).text();
  console.log(html.substring(html.indexOf('Minors allowed?'), html.indexOf('Minors allowed?') + 200));
}
run();
