import React, { useState, useEffect, useMemo } from 'react';
import { 
  Building2, 
  Receipt, 
  Wallet, 
  Users, 
  Download, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  TrendingUp,
  CreditCard,
  Loader2,
  IndianRupee,
  ArrowRightLeft,
  UserCircle,
  Save,
  AlertCircle
} from 'lucide-react';

const MEMBERS = ['Anjaneyulu', 'Srinivas', 'Goutham'];

const DEFAULT_SHOPS_DATA = [
  { name: 'Medical Shop', baseRent: 55000 },
  { name: 'Sham Home', baseRent: 63000 },
  { name: 'Brown Bear', baseRent: 45000 },
  { name: 'Dental', baseRent: 13000 },
  { name: 'Gym', baseRent: 45000 },
  { name: 'Bhavya Clinic', baseRent: 10500 },
];

const App = () => {
  // --- STATE MANAGEMENT (Local Storage) ---
  const [shops, setShops] = useState(() => {
    try {
      const saved = localStorage.getItem('rentManager_shops');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [records, setRecords] = useState(() => {
    try {
      const saved = localStorage.getItem('rentManager_records');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [expenses, setExpenses] = useState(() => {
    try {
      const saved = localStorage.getItem('rentManager_expenses');
      return saved ? JSON.parse(saved) : [];
    } catch (e) { return []; }
  });

  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  
  // Form Inputs
  const [newShopName, setNewShopName] = useState('');
  const [newShopRent, setNewShopRent] = useState('');
  const [newExpenseDesc, setNewExpenseDesc] = useState('');
  const [newExpenseAmount, setNewExpenseAmount] = useState('');
  const [newExpensePayer, setNewExpensePayer] = useState('Shared');
  
  const [pdfLibraryLoaded, setPdfLibraryLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  // --- EFFECTS: SAVE TO LOCAL STORAGE ---
  useEffect(() => {
    localStorage.setItem('rentManager_shops', JSON.stringify(shops));
  }, [shops]);

  useEffect(() => {
    localStorage.setItem('rentManager_records', JSON.stringify(records));
  }, [records]);

  useEffect(() => {
    localStorage.setItem('rentManager_expenses', JSON.stringify(expenses));
  }, [expenses]);

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  // Load PDF Libraries from CDN
  useEffect(() => {
    const loadScript = (url) => {
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = url;
        script.async = true;
        script.onload = resolve;
        document.head.appendChild(script);
      });
    };

    const initPdfLibs = async () => {
      try {
        if (!window.jspdf) {
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
            await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js');
        }
        setPdfLibraryLoaded(true);
      } catch (err) {
        console.error("Failed to load PDF libraries", err);
      }
    };

    initPdfLibs();
  }, []);

  // --- CALCULATIONS ---
  const monthlyData = useMemo(() => {
    const monthRecords = records.filter(r => r.month === currentMonth);
    const monthExpenses = expenses.filter(e => e.month === currentMonth);
    
    // Total Rent Received
    const received = monthRecords
      .filter(r => r.status === 'Paid')
      .reduce((sum, r) => sum + Number(r.amountPaid || 0), 0);
    
    // Total Expenses
    const totalExpenses = monthExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    
    // Net Profit & Split
    const net = received - totalExpenses;
    const split = net / 3;

    // --- Settlement Logic ---
    const memberBalances = {};
    MEMBERS.forEach(m => memberBalances[m] = 0);

    // Rent Collected
    monthRecords.forEach(r => {
      if (r.status === 'Paid' && r.collectedBy && MEMBERS.includes(r.collectedBy)) {
        memberBalances[r.collectedBy] += Number(r.amountPaid || 0);
      }
    });

    // Expenses Paid
    monthExpenses.forEach(e => {
      if (e.paidBy && MEMBERS.includes(e.paidBy)) {
        memberBalances[e.paidBy] -= Number(e.amount || 0);
      }
    });

    // Balances
    const settlements = MEMBERS.map(member => {
      const holding = memberBalances[member];
      const balance = holding - split; 
      return { member, holding, balance };
    });

    // Transactions Logic
    const debtors = settlements.filter(s => s.balance > 0.01).sort((a, b) => b.balance - a.balance);
    const creditors = settlements.filter(s => s.balance < -0.01).sort((a, b) => a.balance - b.balance);
    
    const transactions = [];
    let dIndex = 0;
    let cIndex = 0;

    const activeDebtors = debtors.map(d => ({...d}));
    const activeCreditors = creditors.map(c => ({...c}));

    while (dIndex < activeDebtors.length && cIndex < activeCreditors.length) {
      const debtor = activeDebtors[dIndex];
      const creditor = activeCreditors[cIndex];
      
      const amount = Math.min(debtor.balance, Math.abs(creditor.balance));
      
      if (amount > 0) {
        transactions.push({
          from: debtor.member,
          to: creditor.member,
          amount: amount
        });
      }

      debtor.balance -= amount;
      creditor.balance += amount;

      if (debtor.balance < 0.01) dIndex++;
      if (Math.abs(creditor.balance) < 0.01) cIndex++;
    }

    return { received, totalExpenses, net, split, monthRecords, monthExpenses, settlements, transactions };
  }, [records, expenses, currentMonth]);

  // --- ACTIONS ---
  const generateId = () => Math.random().toString(36).substr(2, 9);

  const seedDefaultShops = () => {
    const newShops = DEFAULT_SHOPS_DATA.map(shop => ({
      id: generateId(),
      name: shop.name,
      baseRent: Number(shop.baseRent),
      createdAt: new Date().toISOString()
    }));
    setShops(prev => [...prev, ...newShops]);
  };

  const addShop = () => {
    if (!newShopName || !newShopRent) return;
    const newShop = {
      id: generateId(),
      name: newShopName,
      baseRent: Number(newShopRent),
      createdAt: new Date().toISOString()
    };
    setShops([...shops, newShop]);
    setNewShopName('');
    setNewShopRent('');
  };

  const deleteShop = (id) => {
    if(window.confirm("Are you sure you want to delete this shop?")) {
        setShops(shops.filter(s => s.id !== id));
    }
  };

  const toggleRentStatus = (shopId, baseRent) => {
    const existingIndex = records.findIndex(r => r.shopId === shopId && r.month === currentMonth);
    
    if (existingIndex >= 0) {
      const updatedRecords = [...records];
      const currentStatus = updatedRecords[existingIndex].status;
      
      updatedRecords[existingIndex] = {
        ...updatedRecords[existingIndex],
        status: currentStatus === 'Paid' ? 'Unpaid' : 'Paid',
        amountPaid: currentStatus === 'Paid' ? 0 : baseRent,
        collectedBy: currentStatus === 'Paid' ? null : MEMBERS[0]
      };
      setRecords(updatedRecords);
    } else {
      const newRecord = {
        id: generateId(),
        shopId,
        month: currentMonth,
        status: 'Paid',
        amountPaid: baseRent,
        collectedBy: MEMBERS[0],
        timestamp: new Date().toISOString()
      };
      setRecords([...records, newRecord]);
    }
  };

  const updateCollectedBy = (shopId, member) => {
    const existingIndex = records.findIndex(r => r.shopId === shopId && r.month === currentMonth);
    if (existingIndex >= 0) {
      const updatedRecords = [...records];
      updatedRecords[existingIndex].collectedBy = member;
      setRecords(updatedRecords);
    }
  };

  const addExpense = () => {
    if (!newExpenseDesc || !newExpenseAmount) return;
    const newExp = {
      id: generateId(),
      description: newExpenseDesc,
      amount: Number(newExpenseAmount),
      paidBy: newExpensePayer,
      month: currentMonth,
      timestamp: new Date().toISOString()
    };
    setExpenses([...expenses, newExp]);
    setNewExpenseDesc('');
    setNewExpenseAmount('');
  };

  const deleteExpense = (id) => {
    setExpenses(expenses.filter(e => e.id !== id));
  };

  // --- PDF GENERATION (COMPACT MODE) ---
  const generatePDF = () => {
    if (!window.jspdf) return;
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const [year, month] = currentMonth.split('-');
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });

    doc.setFont("helvetica", "bold");
    
    // Compact Header
    doc.setFillColor(248, 250, 252);
    doc.rect(0, 0, 210, 25, 'F');
    
    doc.setFontSize(16);
    doc.setTextColor(30, 41, 59);
    doc.text(`Rent Report: ${monthName} ${year}`, 14, 16);
    
    const today = new Date();
    const dateStr = `${today.getDate()}/${today.getMonth() + 1}/${today.getFullYear()}`;

    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`Date: ${dateStr}`, 160, 16);

    // Compact Summary Cards
    const cardY = 30;
    const cardWidth = 43; // Small width
    const cardHeight = 20; // Small height
    const gap = 8;
    const margin = 14;

    // Green Card
    doc.setFillColor(34, 197, 94);
    doc.roundedRect(margin, cardY, cardWidth, cardHeight, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('RECEIVED', margin + 4, cardY + 7);
    doc.setFontSize(11);
    doc.text(`Rs. ${monthlyData.received.toLocaleString()}`, margin + 4, cardY + 16);

    // Red Card
    doc.setFillColor(239, 68, 68);
    doc.roundedRect(margin + cardWidth + gap, cardY, cardWidth, cardHeight, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('EXPENSES', margin + cardWidth + gap + 4, cardY + 7);
    doc.setFontSize(11);
    doc.text(`Rs. ${monthlyData.totalExpenses.toLocaleString()}`, margin + cardWidth + gap + 4, cardY + 16);

    // Blue Card
    doc.setFillColor(59, 130, 246);
    doc.roundedRect(margin + (cardWidth + gap) * 2, cardY, cardWidth, cardHeight, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.text('TARGET SPLIT', margin + (cardWidth + gap) * 2 + 4, cardY + 7);
    doc.setFontSize(11);
    doc.text(`Rs. ${monthlyData.split.toLocaleString()}`, margin + (cardWidth + gap) * 2 + 4, cardY + 16);

    doc.setTextColor(0, 0, 0);

    let currentY = cardY + cardHeight + 10;

    // Compact Table Styles
    const tableStyles = { fontSize: 8, cellPadding: 1.5, fontStyle: 'bold' };
    const headStyles = { fillColor: [59, 130, 246], fontStyle: 'bold', fontSize: 8, cellPadding: 2 };

    if (monthlyData.transactions.length > 0) {
        doc.setFontSize(10);
        doc.setTextColor(30, 41, 59);
        doc.text('Settlement Plan', 14, currentY);
        
        const transactionBody = monthlyData.transactions.map(t => [
            t.from, 'pays', t.to,
            `Rs. ${t.amount.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}`
        ]);

        doc.autoTable({
            startY: currentY + 3,
            head: [['From', 'Action', 'To', 'Amount']],
            body: transactionBody,
            theme: 'striped',
            headStyles: headStyles,
            styles: tableStyles,
            margin: { left: 14, right: 14 }
        });
        currentY = doc.lastAutoTable.finalY + 8;
    }

    const shopBody = shops.map(shop => {
      const rec = monthlyData.monthRecords.find(r => r.shopId === shop.id);
      return [
        shop.name,
        `Rs. ${shop.baseRent}`,
        rec?.status === 'Paid' ? `Paid (${rec.collectedBy || '-'})` : 'Unpaid',
        `Rs. ${rec?.amountPaid || 0}`
      ];
    });

    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text('Shop Payment Details', 14, currentY);
    
    doc.autoTable({
      startY: currentY + 3,
      head: [['Shop Name', 'Base Rent', 'Status', 'Paid']],
      body: shopBody,
      theme: 'grid',
      headStyles: { ...headStyles, fillColor: [71, 85, 105] },
      styles: tableStyles,
      columnStyles: {
        2: { fontStyle: 'bold', textColor: (cell) => cell.raw.startsWith('Paid') ? [34, 197, 94] : [239, 68, 68] }
      },
      didParseCell: function(data) {
        if (data.section === 'body' && data.column.index === 2) {
             data.cell.styles.textColor = data.cell.raw.startsWith('Paid') ? [34, 197, 94] : [239, 68, 68];
        }
      }
    });

    currentY = doc.lastAutoTable.finalY + 8;

    if (monthlyData.monthExpenses.length > 0) {
      if (currentY > 250) { doc.addPage(); currentY = 20; }

      const expenseBody = monthlyData.monthExpenses.map(exp => [
        exp.description, exp.paidBy || 'Shared', `Rs. ${exp.amount.toLocaleString()}`
      ]);
      doc.text('Monthly Expenditures', 14, currentY);
      doc.autoTable({
        startY: currentY + 3,
        head: [['Description', 'Paid By', 'Amount']],
        body: expenseBody,
        theme: 'striped',
        headStyles: { ...headStyles, fillColor: [239, 68, 68] },
        styles: tableStyles
      });
    }

    doc.save(`Rent_Report_${currentMonth}.pdf`);
  };

  const changeMonth = (delta) => {
    const [year, month] = currentMonth.split('-').map(Number);
    // Fixed: Use Date.UTC to prevent timezone offset issues causing wrong month calculation
    const date = new Date(Date.UTC(year, month - 1 + delta, 1));
    setCurrentMonth(date.toISOString().slice(0, 7));
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-screen bg-gray-50 gap-4">
      <Loader2 className="animate-spin text-indigo-600" size={48} />
      <p className="text-gray-500 font-medium">Loading local data...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans pb-12">
      <header className="bg-white border-b sticky top-0 z-20 shadow-sm backdrop-blur-md bg-white/80">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:h-20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-start">
            <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-200">
              <Building2 size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Gujjari's Rental</h1>
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wider"> @Bhavzz creation</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
            <div className="flex items-center bg-white rounded-xl p-1 border shadow-sm ring-1 ring-slate-100">
              <button onClick={() => changeMonth(-1)} className="p-2 hover:bg-slate-50 rounded-lg transition-colors active:scale-95 text-slate-500">
                <ChevronLeft size={20} />
              </button>
              <div className="px-4 text-center border-x border-slate-100">
                 <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Period</span>
                 <span className="font-bold text-slate-800 text-sm whitespace-nowrap">
                   {new Date(currentMonth + '-01').toLocaleDateString('default', { month: 'long', year: 'numeric' })}
                 </span>
              </div>
              <button onClick={() => changeMonth(1)} className="p-2 hover:bg-slate-50 rounded-lg transition-colors active:scale-95 text-slate-500">
                <ChevronRight size={20} />
              </button>
            </div>
            <button 
              onClick={generatePDF}
              disabled={!pdfLibraryLoaded}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg active:scale-95 border ${
                pdfLibraryLoaded 
                ? 'bg-slate-900 hover:bg-slate-800 text-white border-transparent shadow-slate-200' 
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
              }`}
            >
              <Download size={18} />
              <span className="hidden sm:inline">Export PDF</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-3 text-amber-800 text-sm">
            <AlertCircle size={20} className="flex-shrink-0" />
            <p><strong>Note:</strong> Data is saved in this browser. If you clear cache or use a different device, data will not be available.</p>
        </div>

        {/* COMPACT STATS GRID: 1 col mobile, 2 cols tablet, 4 cols desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
          <StatCard title="Received" value={monthlyData.received} type="success" icon={TrendingUp} />
          <StatCard title="Expenses" value={monthlyData.totalExpenses} type="danger" icon={Receipt} />
          <StatCard title="Net Profit" value={monthlyData.net} type="primary" icon={Wallet} />
          <StatCard title="Share (1/3)" value={monthlyData.split} type="warning" icon={Users} />
        </div>

        {/* MAIN LAYOUT: 1 col (mobile/tablet), 3 cols (desktop) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* LEFT COLUMN: Shops & Expenses List */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Settlement Calculator */}
            {monthlyData.transactions.length > 0 && (
              <section className="bg-indigo-900 rounded-3xl shadow-xl p-6 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                   <ArrowRightLeft size={120} />
                </div>
                <div className="relative z-10">
                   <h2 className="text-lg font-bold flex items-center gap-2 mb-4">
                      <ArrowRightLeft className="text-indigo-300" />
                      Settlement Plan
                   </h2>
                   <div className="grid gap-3">
                      {monthlyData.transactions.map((t, idx) => (
                        <div key={idx} className="bg-white/10 backdrop-blur-md rounded-xl p-3 flex flex-col sm:flex-row items-center justify-between border border-white/5 gap-3">
                            <div className="flex items-center gap-3 w-full sm:w-auto">
                                <div className="bg-rose-500/20 text-rose-300 p-1.5 rounded-lg font-bold text-xs uppercase flex-1 sm:flex-none text-center sm:w-24">
                                    {t.from}
                                </div>
                                <span className="text-white/50 text-xs">pays</span>
                                <div className="bg-emerald-500/20 text-emerald-300 p-1.5 rounded-lg font-bold text-xs uppercase flex-1 sm:flex-none text-center sm:w-24">
                                    {t.to}
                                </div>
                            </div>
                            <div className="font-bold text-lg font-mono">
                                ₹{t.amount.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}
                            </div>
                        </div>
                      ))}
                   </div>
                </div>
              </section>
            )}

            {/* Shop List Management */}
            <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                    <Building2 className="text-indigo-500" size={20} />
                    Shop Status
                  </h2>
                </div>
                {shops.length === 0 && (
                  <button 
                    onClick={seedDefaultShops}
                    className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-200 w-full sm:w-auto justify-center"
                  >
                    <Save size={14} />
                    Load Default Shops
                  </button>
                )}
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead>
                    <tr className="bg-slate-50/50 text-xs font-bold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                      <th className="px-6 py-4">Shop Details</th>
                      <th className="px-4 py-4">Rent Amount</th>
                      <th className="px-4 py-4 text-center">Status & Collector</th>
                      <th className="px-4 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {shops.map(shop => {
                      const record = monthlyData.monthRecords.find(r => r.shopId === shop.id);
                      const isPaid = record?.status === 'Paid';
                      const collectedBy = record?.collectedBy || MEMBERS[0];
                      
                      return (
                        <tr key={shop.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4">
                            <span className="font-bold text-slate-700 block text-sm">{shop.name}</span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1 font-bold text-slate-600 font-mono bg-slate-100 w-fit px-2 py-1 rounded text-xs">
                              <IndianRupee size={12} />
                              {shop.baseRent.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col items-center gap-2">
                                <button 
                                onClick={() => toggleRentStatus(shop.id, shop.baseRent)}
                                className={`relative overflow-hidden inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-bold transition-all shadow-sm active:scale-95 border w-full justify-center ${
                                    isPaid 
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-100 hover:bg-emerald-100' 
                                    : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'
                                }`}
                                >
                                {isPaid ? <CheckCircle2 size={12} className="text-emerald-500" /> : <div className="w-3 h-3 rounded-full border-2 border-slate-300"></div>}
                                {isPaid ? 'PAID' : 'MARK PAID'}
                                </button>
                                
                                {isPaid && (
                                    <select 
                                        value={collectedBy}
                                        onChange={(e) => updateCollectedBy(shop.id, e.target.value)}
                                        className="text-[10px] p-1 border rounded bg-slate-50 text-slate-600 outline-none focus:ring-1 focus:ring-indigo-500 w-full"
                                    >
                                        {MEMBERS.map(m => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button 
                              onClick={() => deleteShop(shop.id)}
                              className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-all"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {shops.length === 0 && (
                      <tr>
                         <td colSpan="4" className="text-center py-8 text-slate-400 text-sm">
                            No shops yet. Click "Load Default Shops" above.
                         </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="p-5 bg-slate-50/50 border-t border-slate-100">
                <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                  <div className="flex-grow w-full sm:w-auto">
                    <input 
                      type="text" 
                      placeholder="Shop Name"
                      className="w-full p-3 rounded-lg border-none bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm"
                      value={newShopName}
                      onChange={(e) => setNewShopName(e.target.value)}
                    />
                  </div>
                  <div className="w-full sm:w-40 relative">
                    <input 
                      type="number" 
                      placeholder="Rent Amount"
                      className="w-full p-3 rounded-lg border-none bg-white shadow-sm ring-1 ring-slate-200 focus:ring-2 focus:ring-indigo-500 outline-none font-medium text-sm"
                      value={newShopRent}
                      onChange={(e) => setNewShopRent(e.target.value)}
                    />
                  </div>
                  <button 
                    onClick={addShop}
                    className="w-full sm:w-auto h-[42px] px-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 font-bold active:scale-95 text-sm"
                  >
                    <Plus size={16} />
                    <span>Add</span>
                  </button>
                </div>
              </div>
            </section>

            {/* Expenses List */}
            <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
              <div className="p-5 border-b border-slate-50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold flex items-center gap-2 text-slate-800">
                    <CreditCard className="text-rose-500" size={20} />
                    Monthly Expenditures
                  </h2>
                </div>
                <div className="bg-rose-50 text-rose-700 px-3 py-1 rounded-lg text-xs font-bold w-full sm:w-auto text-center">
                  Total: ₹{monthlyData.totalExpenses.toLocaleString()}
                </div>
              </div>
              <div className="p-5 space-y-3 max-h-[400px] overflow-y-auto custom-scrollbar">
                {monthlyData.monthExpenses.map(exp => (
                  <div key={exp.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-all group ring-1 ring-slate-50 gap-3">
                    <div className="flex items-center gap-4 w-full sm:w-auto">
                      <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center shadow-inner flex-shrink-0">
                        <Receipt size={18} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-700 text-sm">{exp.description}</p>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-medium uppercase tracking-wider">
                           <span>{new Date(exp.timestamp).toLocaleDateString()}</span>
                           <span>•</span>
                           <span className="text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">Paid by {exp.paidBy || 'Shared'}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                      <span className="font-bold text-rose-600 text-lg font-mono">-₹{exp.amount.toLocaleString()}</span>
                      <button 
                        onClick={() => deleteExpense(exp.id)}
                        className="text-slate-300 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-all"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                {monthlyData.monthExpenses.length === 0 && (
                  <div className="text-center py-10 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                    <p className="text-slate-500 font-medium text-sm">No expenses recorded</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN: Sidebar Tools */}
          <div className="space-y-6">
             {/* Balance Sheet */}
             <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-5">
                 <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                    <UserCircle size={20} className="text-indigo-500" />
                    Balance Sheet
                 </h3>
                 <div className="space-y-2">
                     {monthlyData.settlements.map((s, idx) => (
                         <div key={idx} className="flex justify-between items-center p-3 bg-slate-50 rounded-xl border border-slate-100">
                             <div className="text-xs font-bold text-slate-700">{s.member}</div>
                             <div className={`text-xs font-mono font-bold ${s.balance > 0 ? 'text-rose-500' : s.balance < 0 ? 'text-emerald-500' : 'text-slate-400'}`}>
                                 {s.balance > 0 ? `Pays ₹${s.balance.toFixed(0)}` : s.balance < 0 ? `Gets ₹${Math.abs(s.balance).toFixed(0)}` : 'Settled'}
                             </div>
                         </div>
                     ))}
                 </div>
             </section>

            {/* Quick Expense Form */}
            <section className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 p-5">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-800">
                <div className="p-1.5 bg-rose-100 rounded-lg text-rose-600">
                   <CreditCard size={16} />
                </div>
                Quick Expense
              </h3>
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 ml-1 uppercase">Description</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Bill"
                    className="w-full p-3 rounded-lg bg-slate-50 border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none font-medium transition-all text-sm"
                    value={newExpenseDesc}
                    onChange={(e) => setNewExpenseDesc(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 ml-1 uppercase">Amount</label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    className="w-full p-3 rounded-lg bg-slate-50 border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none font-medium transition-all text-sm"
                    value={newExpenseAmount}
                    onChange={(e) => setNewExpenseAmount(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 ml-1 uppercase">Paid By</label>
                    <select 
                        className="w-full p-3 rounded-lg bg-slate-50 border-none ring-1 ring-slate-100 focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none font-medium transition-all text-slate-700 text-sm"
                        value={newExpensePayer}
                        onChange={(e) => setNewExpensePayer(e.target.value)}
                    >
                        <option value="Shared">Shared / Pool</option>
                        {MEMBERS.map(m => (
                            <option key={m} value={m}>{m}</option>
                        ))}
                    </select>
                </div>
                <button 
                  onClick={addExpense}
                  className="w-full py-3 mt-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-black transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 text-sm"
                >
                  <Plus size={16} />
                  Record
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #cbd5e1; }
      `}</style>
    </div>
  );
};

// Compact & Responsive Stat Card
const StatCard = ({ title, value, type, icon: Icon }) => {
  const styles = {
    success: { bg: "bg-white", border: "border-emerald-100", iconBg: "bg-emerald-50", iconColor: "text-emerald-600", textColor: "text-emerald-700" },
    danger: { bg: "bg-white", border: "border-rose-100", iconBg: "bg-rose-50", iconColor: "text-rose-600", textColor: "text-rose-700" },
    primary: { bg: "bg-white", border: "border-indigo-100", iconBg: "bg-indigo-50", iconColor: "text-indigo-600", textColor: "text-indigo-700" },
    warning: { bg: "bg-white", border: "border-amber-100", iconBg: "bg-amber-50", iconColor: "text-amber-600", textColor: "text-amber-700" }
  };

  const style = styles[type];

  return (
    <div className={`${style.bg} p-4 rounded-2xl border ${style.border} shadow-sm flex flex-col justify-between min-h-[100px] transition-all relative overflow-hidden`}>
      <div className="flex justify-between items-start relative z-10 mb-1">
         <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{title}</p>
         <div className={`p-1.5 rounded-lg ${style.iconBg} ${style.iconColor}`}>
          <Icon size={14} />
        </div>
      </div>
      <div className="relative z-10">
        <h3 className={`text-xl font-black tracking-tight ${style.textColor} flex items-center gap-0.5`}>
          <span className="text-sm opacity-60">₹</span>
          {Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </h3>
      </div>
    </div>
  );
};

export default App;