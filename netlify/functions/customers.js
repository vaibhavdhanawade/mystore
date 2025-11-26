const { readFile, writeFile } = require('./_helpers');


exports.handler = async function (event, context) {
const method = event.httpMethod;
if (method === 'GET') {
const data = readFile('customers.json');
return { statusCode: 200, body: JSON.stringify(data) };
}


if (method === 'POST') {
try {
const body = JSON.parse(event.body || '{}');
const customers = readFile('customers.json');
const id = Date.now().toString();
const c = { id, first: body.first || '', last: body.last || '', mobile: body.mobile || '' };
customers.push(c);
writeFile('customers.json', customers);
return { statusCode: 201, body: JSON.stringify(c) };
} catch (e) {
return { statusCode: 400, body: 'Invalid body' };
}
}


if (method === 'DELETE') {
const { id } = event.queryStringParameters || {};
if (!id) return { statusCode: 400, body: 'Missing id' };
const customers = readFile('customers.json');
const updated = customers.filter((c) => String(c.id) !== String(id));
writeFile('customers.json', updated);
return { statusCode: 200, body: JSON.stringify({ id }) };
}


return { statusCode: 405, body: 'Method not allowed' };
};