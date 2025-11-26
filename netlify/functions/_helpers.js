const fs = require('fs');
const path = require('path');


// data folder relative to repository root
const DATA_DIR = path.join(__dirname, '..', '..', 'data');


function readFile(fileName) {
const full = path.join(DATA_DIR, fileName);
if (!fs.existsSync(full)) return [];
try {
const raw = fs.readFileSync(full, 'utf8');
return JSON.parse(raw || '[]');
} catch (err) {
console.error('readFile error', err);
return [];
}
}


function writeFile(fileName, data) {
const full = path.join(DATA_DIR, fileName);
try {
// ensure data directory exists
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
fs.writeFileSync(full, JSON.stringify(data, null, 2), 'utf8');
return true;
} catch (err) {
console.error('writeFile error', err);
return false;
}
}


module.exports = { readFile, writeFile };