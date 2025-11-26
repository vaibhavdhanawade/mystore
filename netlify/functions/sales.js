const { readFile, writeFile } = require('./_helpers');


exports.handler = async function (event, context) {
const method = event.httpMethod;
if (method === 'GET') {
const data = readFile('sales.json');
return { statusCode: 200, body: JSON.stringify(data) };
}


if (method === 'POST') {
try {
const body = JSON.parse(event.body || '{}');
const sales = readFile('sales.json');
const id = Date.now().toString();
const s = {
id,
customerId: body.customerId || '',
amount: Number(body.amount || 0),
paid: Number(body.paid || 0),
datetime: body.datetime || new Date().toISOString(),
photo: body.photo || null // note: not storing binary – keep as data URL if passed
};
sales.push(s);
writeFile('sales.json', sales);


// If paid > 0 create auto payment (append to payments.json)
if (s.paid > 0) {
const payments = readFile('payments.json');
const payment = { id: `auto-${Date.now().toString()}`, customerId: s.customerId, amount: s.paid, datetime: s.datetime };
payments.push(payment);
writeFile('payments.json', payments);
}


return { statusCode: 201, body: JSON.stringify(s) };
} catch (e) {
console.error(e);
return { statusCode: 400, body: 'Invalid body' };
}
}


if (method === 'DELETE') {
const { id } = event.queryStringParameters || {};
if (!id) return { statusCode: 400, body: 'Missing id' };
const sales = readFile('sales.json');
const updated = sales.filter((s) => String(s.id) !== String(id));
writeFile('sales.json', updated);
return { statusCode: 200, body: JSON.stringify({ id }) };
}


return { statusCode: 405, body: 'Method not allowed' };
};