const { readFile, writeFile } = require('./_helpers');


exports.handler = async function (event, context) {
const method = event.httpMethod;
if (method === 'GET') {
const data = readFile('payments.json');
return { statusCode: 200, body: JSON.stringify(data) };
}


if (method === 'POST') {
try {
const body = JSON.parse(event.body || '{}');
const payments = readFile('payments.json');
const id = Date.now().toString();
const p = { id, customerId: body.customerId || '', amount: Number(body.amount || 0), datetime: body.datetime || new Date().toISOString() };
payments.push(p);
writeFile('payments.json', payments);
return { statusCode: 201, body: JSON.stringify(p) };
} catch (e) {
return { statusCode: 400, body: 'Invalid body' };
}
}


if (method === 'DELETE') {
const { id } = event.queryStringParameters || {};
if (!id) return { statusCode: 400, body: 'Missing id' };
const payments = readFile('payments.json');
const updated = payments.filter((p) => String(p.id) !== String(id));
writeFile('payments.json', updated);
return { statusCode: 200, body: JSON.stringify({ id }) };
}


return { statusCode: 405, body: 'Method not allowed' };
};