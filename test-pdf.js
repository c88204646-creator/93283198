const { createRequire } = require('module');
const req = createRequire(__filename);
const pdf = req('pdf-parse');
console.log('Type:', typeof pdf);
console.log('Is function:', typeof pdf === 'function');
