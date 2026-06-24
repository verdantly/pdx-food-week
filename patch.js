const fs = require('fs');
let data = fs.readFileSync('data/nachoweek2026.js', 'utf8');
data = data.replace(/("takeout": false,\s*"minors": false,\s*"desc": "Winner of Best Chili and Beer Pairing)/, '  "takeout": true,\n      "minors": true,\n      "desc": "Winner of Best Chili and Beer Pairing');
fs.writeFileSync('data/nachoweek2026.js', data, 'utf8');
