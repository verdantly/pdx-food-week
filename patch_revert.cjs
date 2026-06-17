const fs = require('fs');
let data = fs.readFileSync('data/nachoweek2026.js', 'utf8');
data = data.replace(/"takeout": true,\s*"minors": true,\s*"desc": "Winner of Best Chili and Beer Pairing/, '"takeout": false,\n      "minors": false,\n      "desc": "Winner of Best Chili and Beer Pairing');
fs.writeFileSync('data/nachoweek2026.js', data, 'utf8');
