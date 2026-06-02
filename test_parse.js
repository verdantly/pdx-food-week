import fs from 'fs';
const KML_PATH = './taco_map.kml';
const kmlContent = fs.readFileSync(KML_PATH, 'utf8');
const placemarkRegex = /<Placemark>([\s\S]*?)<\/Placemark>/g;
let match;
while ((match = placemarkRegex.exec(kmlContent)) !== null) {
  const pmContent = match[1];
  const nameMatch = pmContent.match(/<name>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/name>/);
  if (!nameMatch) continue;
  const name = (nameMatch[1] || nameMatch[2] || '').trim();
  if (name.includes('Arelis') || name.includes('Level')) {
    console.log('---', name, '---');
    const descMatch = pmContent.match(/<description>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/description>/);
    const descHtml = descMatch ? (descMatch[1] || descMatch[2] || '') : '';
    console.log('DescHtml length:', descHtml.length);
    const imgMatch = descHtml.match(/src="([^"]+)"/);
    console.log('ImgMatch:', imgMatch ? imgMatch[1] : 'none');
  }
}
