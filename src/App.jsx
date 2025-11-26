// React + Tailwind CSS Grocery Store App
// Clean single-file app with Home tiles, Customers, Sales, Payments, Ledger Report

import React, { useState, useMemo, useEffect } from "react";

export default function App() {
  // Navigation / Auth
  const [page, setPage] = useState("login");
  const [LoggedIn, setLoggedIn] = useState(false);

  const [loginMobile, setLoginMobile] = useState("");
  const [loginPassword, setLoginPassword] = useState("");


  // Data stores (in-memory)
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const [payments, setPayments] = useState([]);

  // Form helpers (optional controlled inputs)
  // Report filters
  const [reportCustomer, setReportCustomer] = useState("all");
  const [reportStart, setReportStart] = useState("");
  const [reportEnd, setReportEnd] = useState("");

  // Pagination for ledger
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    const saved = localStorage.getItem("session");
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.loggedIn) {
        setLoggedIn(true);
      }
    }
  }, []);
  

  // --- AUTH ---
  const handleLogin = (e) => {
    e.preventDefault();

    if (loginMobile === "admin" && loginPassword === "admin") {
      console.log("ddd");
      const session = { loggedIn: true, time: Date.now() };
      localStorage.setItem("session", JSON.stringify(session));
      setLoggedIn(true);
      setPage('home')
    } else {
      console.log("dddd")
      alert("Invalid credentials");
    }
  };

  // --- CUSTOMERS ---
  const addCustomer = (e) => {
    e.preventDefault();
    const first = e.target.first.value || "";
    const last = e.target.last.value || "";
    const mobile = e.target.mobile.value || "";
    const c = { id: Date.now().toString(), first, last, mobile };
    setCustomers((p) => [...p, c]);
    e.target.reset();
  };

  const deleteCustomer = (id) => {
    setCustomers((p) => p.filter((c) => c.id !== id));
    // optionally remove related sales/payments
  };

  // --- SALES ---
  const addSale = (e) => {
    e.preventDefault();
    const customerId = e.target.customerId.value || "";
    const amount = Number(e.target.amount.value) || 0;
    const paid = Number(e.target.paid.value) || 0;
    const datetimeInput = e.target.datetime.value;
    const datetime = datetimeInput ? new Date(datetimeInput).toISOString() : new Date().toISOString();
    const file = e.target.photo.files && e.target.photo.files[0];
    const photo = file ? URL.createObjectURL(file) : null;

    const sale = {
      id: Date.now().toString(),
      customerId,
      amount,
      paid,
      datetime,
      photo,
    };

    setSales((p) => [...p, sale]);

    // if paid amount > 0 create a payment record so ledger reflects it
    if (paid > 0) {
      const payment = {
        id: `auto-${Date.now().toString()}`,
        customerId,
        amount: paid,
        datetime,
      };
      setPayments((p) => [...p, payment]);
    }

    e.target.reset();
  };

  // --- PAYMENTS ---
  const addPayment = (e) => {
    e.preventDefault();
    const customerId = e.target.customerId.value || "";
    const amount = Number(e.target.amount.value) || 0;
    const datetimeInput = e.target.datetime.value;
    const datetime = datetimeInput ? new Date(datetimeInput).toISOString() : new Date().toISOString();
    const payment = { id: Date.now().toString(), customerId, amount, datetime };
    setPayments((p) => [...p, payment]);
    e.target.reset();
  };

  // --- LEDGER (merge sales and payments chronologlogically) ---
  const { ledgerRows, totalSales, totalPayments } = useMemo(() => {
    const rc = reportCustomer || "all";
    const rs = reportStart || "";
    const re = reportEnd || "";

    const fSales = sales.filter((s) => {
      const matchCustomer = rc === "all" || String(s.customerId) === String(rc);
      const d = s.datetime ? new Date(s.datetime).toISOString().slice(0, 10) : "";
      const matchStart = !rs || d >= rs;
      const matchEnd = !re || d <= re;
      return matchCustomer && matchStart && matchEnd;
    });

    const fPayments = payments.filter((p) => {
      const matchCustomer = rc === "all" || String(p.customerId) === String(rc);
      const d = p.datetime ? new Date(p.datetime).toISOString().slice(0, 10) : "";
      const matchStart = !rs || d >= rs;
      const matchEnd = !re || d <= re;
      return matchCustomer && matchStart && matchEnd;
    });

    const tx = [];
    fSales.forEach((s) => tx.push({ id: `sale-${s.id}`, type: "sale", date: s.datetime, customerId: s.customerId, amount: Number(s.amount || 0), photo: s.photo || null }));
    fPayments.forEach((p) => tx.push({ id: `pay-${p.id}`, type: "payment", date: p.datetime, customerId: p.customerId, amount: Number(p.amount || 0) }));

    tx.sort((a, b) => new Date(a.date) - new Date(b.date));

    // compute running balances (per-customer when rc !== 'all', otherwise overall)
    const perCustomer = rc !== "all";
    const balances = {};
    let running = 0;

    const ledger = tx.map((t) => {
      const cust = customers.find((c) => String(c.id) === String(t.customerId));
      const name = cust ? `${cust.first} ${cust.last}`.trim() : "Unknown";
      if (perCustomer) {
        const key = String(t.customerId || "");
        balances[key] = balances[key] || 0;
        if (t.type === "sale") {
          balances[key] += t.amount;
          return { ...t, customerName: name, debit: t.amount, credit: 0, balance: balances[key] };
        } else {
          balances[key] -= t.amount;
          return { ...t, customerName: name, debit: 0, credit: t.amount, balance: balances[key] };
        }
      } else {
        if (t.type === "sale") {
          running += t.amount;
          return { ...t, customerName: name, debit: t.amount, credit: 0, balance: running };
        } else {
          running -= t.amount;
          return { ...t, customerName: name, debit: 0, credit: t.amount, balance: running };
        }
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

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(1);
  }, [totalPages]);

  // --- UI ---
  if (!LoggedIn) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-100">
        <form onSubmit={(e)=>handleLogin(e)} className="bg-white p-6 shadow rounded w-80 space-y-4">
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
      {/* Home tiles */}
      {page === "home" && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => {
                localStorage.removeItem("session");
                setLoggedIn(false);
              }}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              Logout
            </button>
          </div>
          <div className="grid grid-cols-2 gap-6 max-w-md mx-auto mt-10">
            {[
              { key: "customers", label: "Customers" },
              { key: "sales", label: "Sales" },
              { key: "payment", label: "Payment" },
              { key: "report", label: "Report" },
            ].map((b) => (
              <button key={b.key} onClick={() => setPage(b.key)} className="bg-blue-600 text-white p-6 rounded-xl text-xl font-semibold shadow hover:bg-blue-700">
                {b.label}
              </button>
            ))}
          </div>
        </>  
      )}

      {/* Back button */}
      {page !== "home" && (
        <button onClick={() => setPage("home")} className="mb-4 px-4 py-2 bg-gray-700 text-white rounded">← Back</button>
      )}

      <marquee><h1 className="mt-8">SWAMI GAGANGIRI STORE PUNGAON</h1></marquee>

      {/* Pages */}
      <div className="mt-4">
        {/* CUSTOMERS */}
        {page === "customers" && (
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
                    <td className="p-2">
                      <button onClick={() => deleteCustomer(c.id)} className="bg-red-600 text-white px-2 py-1 rounded text-xs">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* SALES */}
        {page === "sales" && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Add Sale</h2>
            <form onSubmit={addSale} className="space-y-3 bg-white p-4 rounded shadow max-w-md">
              <select name="customerId" className="border p-2 w-full rounded" required>
                <option value="">Select Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.first} {c.last}</option>
                ))}
              </select>
              <input name="amount" type="number" className="border p-2 w-full rounded" placeholder="Sale Amount" required />
              <input name="paid" type="number" className="border p-2 w-full rounded" placeholder="Paid Now (optional)" />
              <input name="datetime" type="date" className="border p-2 w-full rounded" defaultValue={new Date().toISOString().slice(0,10)} />
              <input name="photo" type="file" className="border p-2 w-full rounded" />
              <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">Add Sale</button>
            </form>
          </div>
        )}

        {/* PAYMENT */}
        {page === "payment" && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Add Payment</h2>
            <form onSubmit={addPayment} className="space-y-3 bg-white p-4 rounded shadow max-w-md">
              <select name="customerId" className="border p-2 w-full rounded" required>
                <option value="">Select Customer</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.first} {c.last}</option>
                ))}
              </select>
              <input name="amount" type="number" className="border p-2 w-full rounded" placeholder="Payment Amount" required />
              <input name="datetime" type="date" className="border p-2 w-full rounded" defaultValue={new Date().toISOString().slice(0,10)} />
              <button className="bg-blue-600 text-white px-4 py-2 rounded w-full">Add Payment</button>
            </form>
          </div>
        )}

        {/* REPORT */}
        {page === "report" && (
          <div>
            <h2 className="text-2xl font-bold mb-4">Ledger Report</h2>

            <div className="bg-white p-4 rounded shadow max-w-2xl space-y-4">
              <select value={reportCustomer} onChange={(e) => { setReportCustomer(e.target.value); setCurrentPage(1); }} className="border p-2 w-full rounded">
                <option value="all">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.first} {c.last}</option>
                ))}
              </select>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label>Start Date</label>
                  <input type="date" value={reportStart} onChange={(e) => { setReportStart(e.target.value); setCurrentPage(1); }} className="border p-2 w-full rounded" />
                </div>
                <div>
                  <label>End Date</label>
                  <input type="date" value={reportEnd} onChange={(e) => { setReportEnd(e.target.value); setCurrentPage(1); }} className="border p-2 w-full rounded" />
                </div>
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
