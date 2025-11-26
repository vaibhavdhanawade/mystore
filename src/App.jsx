import React, { useState, useMemo, useEffect } from 'react';

const api = {
  get: async (path) => {
    const res = await fetch(`/.netlify/functions/${path}`);
    if (!res.ok) throw new Error('Network error');
    return res.json();
  },
  post: async (path, body) => {
    const res = await fetch(`/.netlify/functions/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Network error');
    return res.json();
  },
  del: async (path, id) => {
    const res = await fetch(`/.netlify/functions/${path}?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Network error');
    return res.json();
  }
};

export default function App() {
  const [page, setPage] = useState('login');
  const [LoggedIn, setLoggedIn] = useState(false);
  const [loginMobile, setLoginMobile] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);

  // report filters
  const [reportCustomer, setReportCustomer] = useState('all');
  const [reportStart, setReportStart] = useState('');
  const [reportEnd, setReportEnd] = useState('');

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // load session
  useEffect(() => {
    const saved = localStorage.getItem('session');
    if (saved) {
      const p = JSON.parse(saved);
      if (p.loggedIn) setLoggedIn(true);
    }
  }, []);

  // load data from server
  const loadAll = async () => {
    try {
      const [c, s, p] = await Promise.all([api.get('customers'), api.get('sales'), api.get('payments')]);
      setCustomers(c || []);
      setSales(s || []);
      setPayments(p || []);
    } catch (e) {
      console.error('loadAll', e);
      alert('Failed to load data from server. Check functions.');
    }
  };

  useEffect(() => { if (LoggedIn) loadAll(); }, [LoggedIn]);

  // auth
  const handleLogin = (e) => {
    e.preventDefault();
    if (loginMobile === 'admin' && loginPassword === 'admin') {
      localStorage.setItem('session', JSON.stringify({ loggedIn: true, time: Date.now() }));
      setLoggedIn(true);
      setPage('home');
    } else {
      alert('Invalid credentials');
    }
  };

  // customers
  const addCustomer = async (e) => {
    e.preventDefault();
    const first = e.target.first.value || '';
    const last = e.target.last.value || '';
    const mobile = e.target.mobile.value || '';
    try {
      const created = await api.post('customers', { first, last, mobile });
      setCustomers((p) => [...p, created]);
      e.target.reset();
    } catch (err) {
      alert('Failed to add customer');
    }
  };

  const deleteCustomer = async (id) => {
    if (!confirm('Delete customer?')) return;
    try {
      await api.del('customers', id);
      setCustomers((p) => p.filter((c) => c.id !== id));
    } catch (err) {
      alert('Failed to delete');
    }
  };

  // sales
  const addSale = async (e) => {
    e.preventDefault();
    const customerId = e.target.customerId.value;
    const amount = Number(e.target.amount.value) || 0;
    const paid = Number(e.target.paid.value) || 0;
    const datetimeInput = e.target.datetime.value;
    const datetime = datetimeInput ? new Date(datetimeInput).toISOString() : new Date().toISOString();

    // note: sending no binary; if a file is chosen we won't upload it — you could extend functions with multipart handling
    const salePayload = { customerId, amount, paid, datetime, photo: null };
    try {
      const created = await api.post('sales', salePayload);
      setSales((p) => [...p, created]);
      // refresh payments because auto-payment may have been created
      const newPayments = await api.get('payments');
      setPayments(newPayments || []);
      e.target.reset();
    } catch (err) {
      alert('Failed to add sale');
    }
  };

  // payments
  const addPayment = async (e) => {
    e.preventDefault();
    const customerId = e.target.customerId.value;
    const amount = Number(e.target.amount.value) || 0;
    const datetimeInput = e.target.datetime.value;
    const datetime = datetimeInput ? new Date(datetimeInput).toISOString() : new Date().toISOString();
    try {
      const created = await api.post('payments', { customerId, amount, datetime });
      setPayments((p) => [...p, created]);
      e.target.reset();
    } catch (err) {
      alert('Failed to add payment');
    }
  };

  // ledger
  const { ledgerRows, totalSales, totalPayments } = useMemo(() => {
    const rc = reportCustomer || 'all';
    const rs = reportStart || '';
    const re = reportEnd || '';

    const fSales = sales.filter((s) => {
      const d = s.datetime ? s.datetime.slice(0, 10) : '';
      return (rc === 'all' || String(s.customerId) === String(rc)) && (!rs || d >= rs) && (!re || d <= re);
    });

    const fPayments = payments.filter((p) => {
      const d = p.datetime ? p.datetime.slice(0, 10) : '';
      return (rc === 'all' || String(p.customerId) === String(rc)) && (!rs || d >= rs) && (!re || d <= re);
    });

    const tx = [];
    fSales.forEach((s) => tx.push({ id: `sale-${s.id}`, type: 'sale', date: s.datetime, customerId: s.customerId, amount: Number(s.amount || 0) }));
    fPayments.forEach((p) => tx.push({ id: `pay-${p.id}`, type: 'payment', date: p.datetime, customerId: p.customerId, amount: Number(p.amount || 0) }));

    tx.sort((a, b) => new Date(a.date) - new Date(b.date));

    let running = 0;
    const ledger = tx.map((t) => {
      const cust = customers.find((c) => String(c.id) === String(t.customerId));
      const name = cust ? `${cust.first} ${cust.last}`.trim() : 'Unknown';
      if (t.type === 'sale') {
        running += t.amount;
        return { ...t, customerName: name, debit: t.amount, credit: 0, balance: running };
      } else {
        running -= t.amount;
        return { ...t, customerName: name, debit: 0, credit: t.amount, balance: running };
      }
    });

    const tSales = ledger.reduce((s, r) => s + (r.debit || 0), 0);
    const tPayments = ledger.reduce((s, r) => s + (r.credit || 0), 0);

    return { ledgerRows: ledger, totalSales: tSales, totalPayments: tPayments };
  }, [sales, payments, customers, reportCustomer, reportStart, reportEnd]);

  // pagination
  const totalPages = Math.max(1, Math.ceil((ledgerRows.length || 0) / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginated = ledgerRows.slice(startIndex, startIndex + pageSize);

  useEffect(() => { if (currentPage > totalPages) setCurrentPage(1); }, [totalPages]);

  if (!LoggedIn) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <form onSubmit={handleLogin} className="bg-white p-6 shadow rounded w-80 space-y-4">
          <h2 className="text-xl font-bold text-center">Login</h2>
          <input name="mobile" className="border p-2 w-full rounded" placeholder="Username" value={loginMobile} onChange={(e) => setLoginMobile(e.target.value)}/>
          <input name="password" type="password" className="border p-2 w-full rounded" placeholder="Password" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
          <button className="bg-blue-600 text-white w-full p-2 rounded">Login</button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6 w-full">
      {page === 'home' && (
        <>
          <div className="flex justify-end mb-4">
            <button onClick={() => { localStorage.removeItem('session'); setLoggedIn(false); }} className="bg-red-600 text-white px-4 py-2 rounded">Logout</button>
          </div>
          <div className="grid grid-cols-2 gap-6 max-w-md mx-auto mt-10">
            {[{ key: 'customers', label: 'Customers' },{ key: 'sales', label: 'Sales' },{ key: 'payment', label: 'Payment' },{ key: 'report', label: 'Report' }].map((b) => (
              <button key={b.key} onClick={() => setPage(b.key)} className="bg-blue-600 text-white p-6 rounded-xl text-xl font-semibold shadow hover:bg-blue-700">{b.label}</button>
            ))}
          </div>
        </>
      )}

      {page !== 'home' && (<button onClick={() => setPage('home')} className="mb-4 px-4 py-2 bg-gray-700 text-white rounded">← Back</button>)}

      <marquee><h1 className="mt-8">SWAMI GAGANGIRI STORE PUNGAON</h1></marquee>

      <div className="mt-4">
        {page === 'customers' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Customers</h2>
            <form onSubmit={addCustomer} className="space-y-3 bg-white p-4 rounded shadow max-w-md">
              <input name="first" className="border p-2 w-full rounded" placeholder="First Name" />
              <input name="last" className="border p-2 w-full rounded" placeholder="Last Name" />
              <input name="mobile" className="border p-2 w-full rounded" placeholder="Mobile" />
              <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">Add Customer</button>
            </form>

            <h3 className="text-xl font-semibold mt-6 mb-2">Customer List</h3>
            <table className="w-full border mt-2 text-sm">
              <thead>
                <tr className="bg-gray-200 text-left">
                  <th className="p-2">Name</th>
                  <th className="p-2">Mobile</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b">
                    <td className="p-2">{c.first} {c.last}</td>
                    <td className="p-2">{c.mobile}</td>
                    <td className="p-2"><button onClick={() => deleteCustomer(c.id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs">Delete</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {page === 'sales' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Add Sale</h2>
            <form onSubmit={addSale} className="space-y-3 bg-white p-4 rounded shadow max-w-md">
              <select name="customerId" className="border p-2 w-full rounded" required>
                <option value="">Select Customer</option>
                {customers.map((c) => (<option key={c.id} value={c.id}>{c.first} {c.last}</option>))}
              </select>
              <input name="amount" type="number" className="border p-2 w-full rounded" placeholder="Sale Amount" required />
              <input name="paid" type="number" className="border p-2 w-full rounded" placeholder="Paid Now (optional)" />
              <input name="datetime" type="date" className="border p-2 w-full rounded" defaultValue={new Date().toISOString().slice(0,10)} />
              <input name="photo" type="file" className="border p-2 w-full rounded" />
              <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">Add Sale</button>
            </form>
          </div>
        )}

        {page === 'payment' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Add Payment</h2>
            <form onSubmit={addPayment} className="space-y-3 bg-white p-4 rounded shadow max-w-md">
              <select name="customerId" className="border p-2 w-full rounded" required>
                <option value="">Select Customer</option>
                {customers.map((c) => (<option key={c.id} value={c.id}>{c.first} {c.last}</option>))}
              </select>
              <input name="amount" type="number" className="border p-2 w-full rounded" placeholder="Payment Amount" required />
              <input name="datetime" type="date" className="border p-2 w-full rounded" defaultValue={new Date().toISOString().slice(0,10)} />
              <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">Add Payment</button>
            </form>
          </div>
        )}

        {page === 'report' && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Ledger Report</h2>
            <div className="bg-white p-4 rounded shadow max-w-2xl space-y-4">
              <select value={reportCustomer} onChange={(e) => { setReportCustomer(e.target.value); setCurrentPage(1); }} className="border p-2 w-full rounded">
                <option value="all">All Customers</option>
                {customers.map((c) => (<option key={c.id} value={c.id}>{c.first} {c.last}</option>))}
              </select>
              <div className="grid grid-cols-2 gap-4">
                <div><label>Start Date</label><input type="date" value={reportStart} onChange={(e) => { setReportStart(e.target.value); setCurrentPage(1); }} className="border p-2 w-full rounded" /></div>
                <div><label>End Date</label><input type="date" value={reportEnd} onChange={(e) => { setReportEnd(e.target.value); setCurrentPage(1); }} className="border p-2 w-full rounded" /></div>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Totals</h3>
              <p><b>Total Sales:</b> ₹{totalSales}</p>
              <p><b>Total Payments:</b> ₹{totalPayments}</p>
              <p><b>Balance:</b> ₹{totalSales - totalPayments}</p>
            </div>

            <table className="w-full border mt-4 text-sm">
              <thead>
                <tr className="bg-gray-200 text-left">
                  <th className="p-2">#</th>
                  <th className="p-2">Customer</th>
                  <th className="p-2">Debit</th>
                  <th className="p-2">Credit</th>
                  <th className="p-2">Balance</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((r, i) => (
                  <tr key={r.id} className="border-b">
                    <td className="p-2">{startIndex + i + 1}</td>
                    <td className="p-2">{r.customerName}</td>
                    <td className="p-2 text-red-600">{r.debit || '-'}</td>
                    <td className="p-2 text-green-600">{r.credit || '-'}</td>
                    <td className="p-2">{r.balance}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="flex gap-2 mt-4">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(currentPage - 1)} className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50">Prev</button>
              <span className="px-3 py-1">Page {currentPage} / {totalPages}</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(currentPage + 1)} className="px-3 py-1 bg-gray-300 rounded disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}