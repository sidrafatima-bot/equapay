window.currentGroup = null;
window.currentCurrency = '₹';
let currentSplitType = 'Equal';
let currentLang = 'english';
window.notificationsEnabled = true;
window.notificationLog = [];
window.groups = [];

// ============================================================
//  PAGE NAVIGATION
// ============================================================
window.showToast = function(msg) {
    const toast = document.getElementById("toastMsg");
    toast.textContent = msg;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}


window.openRemindPanel = function() {
    openModal('remindModal');
};
window.openProfileModal = function() {
    document.getElementById('profileModal').style.display = 'flex';
};
window.showPage = function (id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const page = document.getElementById(id);
    if (page) page.classList.add('active');
    const sidebar = document.getElementById('sidebar');
    if (sidebar && sidebar.classList.contains('open')) toggleMenu();
    const bottomNav = document.getElementById('bottomNav');
    if (bottomNav) {
        bottomNav.style.display = ['welcome', 'login'].includes(id) ? 'none' : 'flex';
    }
    if (id === 'settlementHistory') renderSettlementHistory();
    if (id === 'analytics') renderAnalytics();
};

window.toggleMenu = function () {
    const s = document.getElementById('sidebar');
    const o = document.getElementById('overlay');
    s.classList.toggle('open');
    o.style.display = s.classList.contains('open') ? 'block' : 'none';
};

window.addExpenseFromNav = function () {
    if (window.currentGroup) { window.showPage('addExpense'); }
    else { alert('Please open a group first!'); }
};

window.addMember = function () {
    const input = document.getElementById('groupMembers');
    const name = input.value.trim();
    if (!name) return;
    const existing = [...document.querySelectorAll('#memberTags .member-tag')]
        .map(tag => tag.childNodes[0].textContent.trim());
    if (existing.includes(name)) { alert(name + ' is already added'); return; }
    const tags = document.getElementById('memberTags');
    const span = document.createElement('span');
    span.className = 'member-tag';
    span.innerHTML = name + ' <button onclick="this.parentElement.remove()">×</button>';
    tags.appendChild(span);
    input.value = '';
};

window.addNewGroup = async function () {
    const groupName = document.getElementById('groupInput').value.trim();
    const membersArray = [...document.querySelectorAll('#memberTags .member-tag')]
        .map(tag => tag.childNodes[0].textContent.trim());
    if (!groupName || membersArray.length === 0) { alert('Please enter group name and members'); return; }
    const newGroup = { name: groupName, members: membersArray, expenses: [], settled: [] };
    const id = await window.saveGroup(newGroup);
    newGroup.id = id;
    window.groups.push(newGroup);
    document.getElementById('groupInput').value = '';
    document.getElementById('groupDesc').value = '';
    document.getElementById('memberTags').innerHTML = '';
    renderDashboard();
    showPage('dashboard');
};

// ============================================================
//  DASHBOARD RENDER
// ============================================================
window.renderDashboard = function () {
    const list = document.getElementById('groupList');
    const noMsg = document.getElementById('noGroupsMsg');
    if (!list) return;
    list.innerHTML = '';
    if (window.groups.length === 0) { noMsg.style.display = 'block'; return; }
    noMsg.style.display = 'none';
    const t = translations[currentLang];
    window.groups.forEach(function (group, index) {
        const total = (group.expenses || []).reduce((s, e) => s + e.amount, 0);
        const card = document.createElement('div');
        card.className = 'expense-card';
        card.innerHTML = `
            <div><strong>${group.name}</strong><br>
            <small>${group.members.length} ${t.members} • ${(group.expenses || []).length} ${t.expenses}</small></div>
            <b class="${total > 0 ? 'red' : 'grey'}">${window.currentCurrency}${total.toFixed(2)}</b>`;
        card.onclick = () => openGroup(index, group.id);
        const isDark = document.body.classList.contains('dark-mode');
        card.style.background = isDark ? '#2d2d2d' : 'white';
        card.style.color = isDark ? 'white' : '#333';
        list.appendChild(card);
    });

    const searchBar = document.getElementById('groupSearchBar');
    if (searchBar) {
        searchBar.oninput = function () {
            const q = this.value.toLowerCase();
            list.querySelectorAll('.expense-card').forEach(card => {
                const name = card.querySelector('strong').textContent.toLowerCase();
                card.style.display = name.includes(q) ? 'flex' : 'none';
            });
        };
    }
    updateNotifBadge();
};

// ============================================================
//  OPEN GROUP
// ============================================================
window.openGroup = async function (index, id) {
    showLoading();
    let group = window.groups[index];
    if (!group || (id && group.id !== id)) group = window.groups.find(g => g.id === id);
    if (!group) { alert('Group not found, please refresh.'); hideLoading(); return; }
    window.currentGroup = group;
    const expenses = await window.loadExpenses(window.currentGroup.id);
    window.currentGroup.expenses = expenses || [];
    const settlements = await window.loadSettlements(window.currentGroup.id);
    window.currentGroup.settled = settlements || [];
    window.groups[index] = window.currentGroup;
    document.getElementById('groupTitle').innerText = window.currentGroup.name;
    const payerSelect = document.getElementById('payerSelect');
    payerSelect.innerHTML = window.currentGroup.members.map(m => `<option value="${m}">${m}</option>`).join('');
    renderChart();
    renderExpenseLog();
    showPage('apartment');
    hideLoading();
    window.listenToGroup(window.currentGroup.id);
};

// ============================================================
//  RENAME GROUP
// ============================================================
window.showRenameGroup = function () {
    const panel = document.getElementById('renameGroupPanel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        if (panel.style.display === 'block') {
            document.getElementById('renameGroupInput').value = window.currentGroup ? window.currentGroup.name : '';
        }
    }
};

window.saveRenameGroup = function () {
    const newName = document.getElementById('renameGroupInput').value.trim();
    if (!newName) { alert('Please enter a group name'); return; }
    if (!window.currentGroup) return;
    window.renameGroup(window.currentGroup.id, newName);
    document.getElementById('renameGroupPanel').style.display = 'none';
};

// ============================================================
//  SPLIT TYPE
// ============================================================
window.selectSplitType = function (type) {
    currentSplitType = type;
    ['Equal', 'Percentage', 'Exact', 'Share'].forEach(t => {
        const btn = document.getElementById('splitBtn' + t);
        if (!btn) return;
        if (t === type) { btn.style.background = '#2d8cff'; btn.style.color = 'white'; btn.style.border = '2px solid #2d8cff'; }
        else { btn.style.background = 'white'; btn.style.color = '#555'; btn.style.border = '2px solid #eee'; }
    });
    const customDiv = document.getElementById('splitCustomFields');
    if (customDiv) { customDiv.style.display = type === 'Equal' ? 'none' : 'block'; updateSplitFields(); }
};

// ============================================================
//  PAYMENT METHOD
// ============================================================
window.selectPaymentMethod = function (method) {
    document.getElementById('paymentMethodSelect').value = method;
    ['UPI', 'Cash', 'Card'].forEach(m => {
        const btn = document.getElementById('pm' + m);
        if (!btn) return;
        if (m === method) btn.classList.add('active-pay');
        else btn.classList.remove('active-pay');
    });
};

// ============================================================
//  SPLIT FIELDS
// ============================================================
window.updateSplitFields = function () {
    if (!window.currentGroup) return;
    const amt = parseFloat(document.getElementById('mainAmount').value) || 0;
    const container = document.getElementById('splitInputsContainer');
    const msg = document.getElementById('splitValidMsg');
    if (!container) return;
    container.innerHTML = '';
    msg.textContent = '';
    if (currentSplitType === 'Percentage') {
        const equalPct = (100 / window.currentGroup.members.length).toFixed(1);
        msg.textContent = 'Must add up to 100%';
        window.currentGroup.members.forEach(member => {
            container.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-size:13px; width:80px;">${member}</span>
                <div style="display:flex; align-items:center; gap:4px;">
                    <input type="number" id="input_${member}" value="${equalPct}"
                        style="width:70px; padding:8px; border:1px solid #eee; border-radius:8px; text-align:right;"
                        oninput="validateSplitInputs(${amt})">
                    <span style="font-size:13px;">%</span>
                </div></div>`;
        });
    } else if (currentSplitType === 'Exact') {
        const equalAmt = amt > 0 ? (amt / window.currentGroup.members.length).toFixed(2) : '0';
        msg.textContent = 'Must add up to ' + window.currentCurrency + amt;
        window.currentGroup.members.forEach(member => {
            container.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-size:13px; width:80px;">${member}</span>
                <div style="display:flex; align-items:center; gap:4px;">
                    <span style="font-size:13px;">${window.currentCurrency}</span>
                    <input type="number" id="input_${member}" value="${equalAmt}"
                        style="width:70px; padding:8px; border:1px solid #eee; border-radius:8px; text-align:right;"
                        oninput="validateSplitInputs(${amt})">
                </div></div>`;
        });
    } else if (currentSplitType === 'Share') {
        msg.textContent = 'Assign shares — more shares = more cost';
        window.currentGroup.members.forEach(member => {
            container.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-size:13px; width:80px;">${member}</span>
                <div style="display:flex; align-items:center; gap:4px;">
                    <input type="number" id="input_${member}" value="1" min="1"
                        style="width:70px; padding:8px; border:1px solid #eee; border-radius:8px; text-align:right;"
                        oninput="validateSplitInputs(${amt})">
                    <span style="font-size:13px;">shares</span>
                </div></div>`;
        });
    }
};

window.validateSplitInputs = function (amt) {
    const msg = document.getElementById('splitValidMsg');
    if (!window.currentGroup || !msg) return;
    if (currentSplitType === 'Percentage') {
        const total = window.currentGroup.members.reduce((s, m) => s + (parseFloat(document.getElementById('input_' + m)?.value) || 0), 0);
        msg.style.color = Math.abs(total - 100) < 1 ? '#5b8f67' : '#d46b82';
        msg.textContent = Math.abs(total - 100) < 1 ? '✓ 100% allocated!' : total.toFixed(1) + '% of 100%';
    } else if (currentSplitType === 'Exact') {
        const total = window.currentGroup.members.reduce((s, m) => s + (parseFloat(document.getElementById('input_' + m)?.value) || 0), 0);
        const diff = (amt - total).toFixed(2);
        msg.style.color = Math.abs(diff) < 0.01 ? '#5b8f67' : '#d46b82';
        msg.textContent = Math.abs(diff) < 0.01 ? '✓ Total matches!' : window.currentCurrency + diff + ' remaining';
    } else if (currentSplitType === 'Share') {
        const totalShares = window.currentGroup.members.reduce((s, m) => s + (parseFloat(document.getElementById('input_' + m)?.value) || 1), 0);
        msg.style.color = '#5b8f67';
        msg.textContent = 'Total shares: ' + totalShares;
    }
};

// ============================================================
//  CALCULATE & SAVE SPLIT
// ============================================================
window.calculateSplit = async function () {
    const amt = parseFloat(document.getElementById('mainAmount').value);
    const name = document.getElementById('expName').value.trim();
    const notes = document.getElementById('expNotes') ? document.getElementById('expNotes').value.trim() : '';
    const payer = document.getElementById('payerSelect').value;
    const paymentMethod = document.getElementById('paymentMethodSelect').value || 'UPI';
    if (!amt || amt <= 0) { alert('Please enter a valid amount'); return; }
    if (!name) { alert('Please enter an item name'); return; }
    if (!window.currentGroup) { alert('No group selected'); return; }
    let splits = {};
    if (currentSplitType === 'Equal') {
        const per = amt / window.currentGroup.members.length;
        window.currentGroup.members.forEach(m => splits[m] = per);
    } else if (currentSplitType === 'Percentage') {
        let total = 0;
        window.currentGroup.members.forEach(m => {
            const pct = parseFloat(document.getElementById('input_' + m)?.value) || 0;
            splits[m] = (pct / 100) * amt; total += pct;
        });
        if (Math.abs(total - 100) > 1) { alert('Percentages must add up to 100%'); return; }
    } else if (currentSplitType === 'Exact') {
        let total = 0;
        window.currentGroup.members.forEach(m => { splits[m] = parseFloat(document.getElementById('input_' + m)?.value) || 0; total += splits[m]; });
        if (Math.abs(total - amt) > 0.01) { alert('Amounts don\'t add up to ' + window.currentCurrency + amt); return; }
    } else if (currentSplitType === 'Share') {
        let totalShares = 0;
        window.currentGroup.members.forEach(m => { totalShares += parseFloat(document.getElementById('input_' + m)?.value) || 1; });
        window.currentGroup.members.forEach(m => { const s = parseFloat(document.getElementById('input_' + m)?.value) || 1; splits[m] = (s / totalShares) * amt; });
    }
    const category = document.getElementById('categorySelect').value;
    const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    const expense = { name, amount: amt, payer, splits, splitType: currentSplitType, category, date, paymentMethod, notes };
window.currentGroup.expenses.push(expense);
await window.saveExpense(window.currentGroup.id, expense);
    document.getElementById('expName').value = '';
    document.getElementById('mainAmount').value = '';
    if (document.getElementById('expNotes')) document.getElementById('expNotes').value = '';
    selectSplitType('Equal');
    renderChart();
    renderExpenseLog();
    renderDashboard();
    updateNotifBadge();
    showPage('apartment');
};

// ============================================================
//  SETTLE UP
// ============================================================
window.settleUp = async function (member, amount) {
    if (!window.currentGroup.settled) window.currentGroup.settled = [];
    const settlement = {
        member,
        amount,
        group: window.currentGroup.name,
        date: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
        time: new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    };
    window.currentGroup.settled.push(settlement);
    await window.saveSettlement(window.currentGroup.id, settlement);
    renderChart();
    renderExpenseLog();
    updateNotifBadge();
};

// ============================================================
//  RENDER CHART
// ============================================================
window.renderChart = function () {
    try {
        if (!window.currentGroup) return;
        const categoryTotals = {};
        (window.currentGroup.expenses || []).forEach(exp => {
            const cat = exp.category || '🧾 Other';
            categoryTotals[cat] = (categoryTotals[cat] || 0) + exp.amount;
        });
        const labels = Object.keys(categoryTotals);
        const values = Object.values(categoryTotals);
        const colors = ['#2d8cff', '#5b8f67', '#d46b82', '#f7c948', '#a855f7', '#f97316'];
        if (window._pieChart) { window._pieChart.destroy(); window._pieChart = null; }
        if (labels.length === 0) {
            document.getElementById('chartMembers').innerHTML = '<p style="color:#aaa; font-size:13px; text-align:center;">No expenses yet</p>';
            return;
        }
        const ctx = document.getElementById('pieChart').getContext('2d');
        window._pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: { labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 2, borderColor: '#fff' }] },
            options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
        });
        const chart = document.getElementById('chartMembers');
        chart.innerHTML = '';
        const owedMap = {};
        window.currentGroup.members.forEach(m => owedMap[m.trim()] = 0);
        (window.currentGroup.expenses || []).forEach(exp => {
            window.currentGroup.members.forEach(m => {
                if (m !== exp.payer) {
                    const amt = exp.splits ? exp.splits[m] : (exp.amount / window.currentGroup.members.length);
                    owedMap[m.trim()] += amt || 0;
                }
            });
        });
        (window.currentGroup.settled || []).forEach(s => { owedMap[s.member] = Math.max(0, (owedMap[s.member] || 0) - s.amount); });
        window.currentGroup.members.forEach(member => {
            const owed = owedMap[member.trim()];
            chart.innerHTML += `<div style="text-align:center; font-size:12px;">
                <div style="font-weight:bold; color:#333;">${member.trim()}</div>
                <div style="color:${owed > 0 ? '#d46b82' : '#5b8f67'};">${owed > 0 ? window.currentCurrency + owed.toFixed(0) : '✓'}</div>
            </div>`;
        });
    } catch (err) { console.error('Chart error:', err); }
};

// ============================================================
//  DEBT SIMPLIFICATION
// ============================================================
function simplifyDebts(owedMap) {
    // Builds simplified transactions: creditors get paid by debtors directly
    const creditors = [], debtors2 = [];
    Object.entries(owedMap).forEach(([m, amt]) => {
        if (amt > 0.01) debtors2.push({ name: m, amt });
        else if (amt < -0.01) creditors.push({ name: m, amt: -amt });
    });
    const txns = [];
    let di = 0, ci = 0;
    while (di < debtors2.length && ci < creditors.length) {
        const d = debtors2[di], c = creditors[ci];
        const pay = Math.min(d.amt, c.amt);
        txns.push({ from: d.name, to: c.name, amt: pay });
        d.amt -= pay; c.amt -= pay;
        if (d.amt < 0.01) di++;
        if (c.amt < 0.01) ci++;
    }
    return txns;
}

// ============================================================
//  RENDER EXPENSE LOG
// ============================================================
window.renderExpenseLog = function () {
    if (!window.currentGroup) return;
    const resultBox = document.getElementById('resultContainer');
    resultBox.innerHTML = '';
    const t = translations[currentLang];
    const totalSpend = (window.currentGroup.expenses || []).reduce((s, e) => s + e.amount, 0);
    const myShare = window.currentGroup.members.length > 0 ? totalSpend / window.currentGroup.members.length : 0;
    resultBox.innerHTML += `
        <div style="background:linear-gradient(135deg,#2d8cff,#5b8f67); color:white; padding:14px; border-radius:14px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between;">
                <div><div style="font-size:11px; opacity:0.8;">${t.totalSpent}</div>
                <div style="font-size:20px; font-weight:bold;">${window.currentCurrency}${totalSpend.toFixed(2)}</div></div>
                <div style="text-align:right;"><div style="font-size:11px; opacity:0.8;">${t.perPerson}</div>
                <div style="font-size:20px; font-weight:bold;">${window.currentCurrency}${myShare.toFixed(2)}</div></div>
            </div>
        </div>`;

    if ((window.currentGroup.expenses || []).length === 0) {
        resultBox.innerHTML += `<div style="text-align:center; color:#aaa; padding:20px;">
            <div style="font-size:30px;">🧾</div><p><b>${t.noExpenses}</b></p>
            <p style="font-size:12px;">${t.tapToAdd}</p></div>`;
    } else {
        resultBox.innerHTML += `<p style="font-weight:bold; color:#555; font-size:13px; margin:10px 0 8px;">${t.expenseHistory}</p>`;
        [...window.currentGroup.expenses].reverse().forEach(exp => {
            const splits = window.currentGroup.members.map(m => {
                const amt = exp.splits ? exp.splits[m] : (exp.amount / window.currentGroup.members.length);
                if (m === exp.payer) return `<span style="font-size:10px; background:#e6f4ea; color:#5b8f67; padding:2px 6px; border-radius:20px;">${m} ${t.paid}</span>`;
                return `<span style="font-size:10px; background:#fde8ee; color:#d46b82; padding:2px 6px; border-radius:20px;">${m} ${t.owes} ${window.currentCurrency}${amt ? amt.toFixed(2) : '0.00'}</span>`;
            }).join(' ');
            const splitLabel = exp.splitType && exp.splitType !== 'Equal'
                ? `<span style="font-size:10px; background:#eef; color:#2d8cff; padding:2px 6px; border-radius:20px; margin-left:4px;">${exp.splitType}</span>` : '';
            const pmIcons = { UPI: '📱', Cash: '💵', Card: '💳' };
            const pmColors = { UPI: '#f0f7ff', Cash: '#f0fff4', Card: '#fff0f6' };
            const pmTextColors = { UPI: '#2d8cff', Cash: '#5b8f67', Card: '#d46b82' };
            const pm = exp.paymentMethod || 'UPI';
            const pmBadge = `<span style="font-size:10px; background:${pmColors[pm] || '#f0f7ff'}; color:${pmTextColors[pm] || '#2d8cff'}; padding:2px 6px; border-radius:20px; margin-left:4px;">${pmIcons[pm] || '📱'} ${pm}</span>`;
           const notesBadge = exp.notes ? `<span style="font-size:10px; background:#f5f5f5; color:#888; padding:2px 6px; border-radius:20px; margin-left:4px;">📝 ${exp.notes}</span>` : '';
const receiptBadge = exp.receipt ? `<div style="margin-top:6px;"><img src="${exp.receipt}" style="max-width:100%; max-height:120px; border-radius:8px; cursor:pointer;" onclick="window.open('${exp.receipt}')"></div>` : '';
            const expIndex = window.currentGroup.expenses.indexOf(exp);
            resultBox.innerHTML += `
                <div class="expense-item-card" style="background:white; padding:12px; border-radius:12px; margin-bottom:8px; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold; color:#333; align-items:center;">
                        <span>${exp.category || ''} ${exp.name} ${splitLabel}${pmBadge}${notesBadge}${receiptBadge}</span>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <span style="font-size:10px; color:#aaa; font-weight:normal;">${exp.date || ''}</span>
                            <span>${window.currentCurrency}${exp.amount}</span>
                            <button onclick="window.openEditExpenseModal(${expIndex})" style="background:none; border:none; color:#2d8cff; font-size:14px; cursor:pointer; padding:0;">✏️</button>
                            <button onclick="confirmDeleteExpense(${expIndex})" style="background:none; border:none; color:#d46b82; font-size:14px; cursor:pointer; padding:0;">🗑️</button>
                        </div>
                    </div>
                   <div style="margin-top:5px;">${splits}</div>${receiptBadge}
                </div>`;
        });

        // Payment method breakdown
        const pmTotals = { UPI: 0, Cash: 0, Card: 0 };
        (window.currentGroup.expenses || []).forEach(exp => {
            const pm = exp.paymentMethod || 'UPI';
            if (pmTotals[pm] !== undefined) pmTotals[pm] += exp.amount;
        });
        if (Object.values(pmTotals).some(v => v > 0)) {
            resultBox.innerHTML += `
                <p style="font-weight:bold; color:#555; font-size:13px; margin:15px 0 8px;">💳 ${t.paymentBreakdown}</p>
                <div style="background:white; padding:12px; border-radius:12px; margin-bottom:12px; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:13px;">📱 UPI</span>
                        <span style="font-weight:bold; color:#2d8cff;">${window.currentCurrency}${pmTotals.UPI.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <span style="font-size:13px;">💵 Cash</span>
                        <span style="font-weight:bold; color:#5b8f67;">${window.currentCurrency}${pmTotals.Cash.toFixed(2)}</span>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-size:13px;">💳 Card</span>
                        <span style="font-weight:bold; color:#d46b82;">${window.currentCurrency}${pmTotals.Card.toFixed(2)}</span>
                    </div>
                </div>`;
        }
    }

    // Settle up section — with simplified debts
    resultBox.innerHTML += `<p style="font-weight:bold; color:#555; font-size:13px; margin:15px 0 8px;">${t.settleUp}</p>`;
    const owedMap = {};
    window.currentGroup.members.forEach(m => owedMap[m] = 0);
    (window.currentGroup.expenses || []).forEach(exp => {
        window.currentGroup.members.forEach(m => {
            if (m !== exp.payer) {
                const amt = exp.splits ? exp.splits[m] : (exp.amount / window.currentGroup.members.length);
                owedMap[m] += amt || 0;
            }
        });
    });
    // Build net balances (positive = owes, negative = is owed)
    const netMap = {};
    window.currentGroup.members.forEach(m => netMap[m] = 0);
    (window.currentGroup.expenses || []).forEach(exp => {
        window.currentGroup.members.forEach(m => {
            if (m === exp.payer) {
                // Payer is owed by others
                netMap[m] -= (exp.amount - (exp.splits ? exp.splits[m] : exp.amount / window.currentGroup.members.length));
            } else {
                const amt = exp.splits ? exp.splits[m] : exp.amount / window.currentGroup.members.length;
                netMap[m] += amt || 0;
            }
        });
    });
    (window.currentGroup.settled || []).forEach(s => {
        owedMap[s.member] = Math.max(0, (owedMap[s.member] || 0) - s.amount);
        netMap[s.member] = (netMap[s.member] || 0) - s.amount;
    });
    const simplifiedTxns = simplifyDebts(netMap);
    let anyUnsettled = false;
    if (simplifiedTxns.length > 0) {
        resultBox.innerHTML += `<div style="background:#f0f7ff; padding:10px; border-radius:10px; margin-bottom:8px; font-size:12px; color:#2d8cff;">💡 Simplified: ${simplifiedTxns.length} transaction${simplifiedTxns.length > 1 ? 's' : ''} needed</div>`;
    }
    window.currentGroup.members.forEach(member => {
        const owed = owedMap[member];
        if (owed > 0.01) {
            anyUnsettled = true;
            resultBox.innerHTML += `
                <div style="background:white; padding:12px; border-radius:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                    <div><span style="font-size:13px; color:#333;">${member.trim()}</span><br>
                    <span style="color:#d46b82; font-size:12px;">${t.owes} ${window.currentCurrency}${owed.toFixed(2)}</span></div>
                    <button onclick="settleUp('${member}', ${owed})"
                        style="background:#5b8f67; color:white; border:none; padding:8px 12px; border-radius:10px; font-size:12px; cursor:pointer;">${t.settle}</button>
                </div>`;
        }
    });
   if (!anyUnsettled && (window.currentGroup.expenses || []).length > 0) {
    resultBox.innerHTML += `<div style="text-align:center; color:#5b8f67; padding:15px; background:white; border-radius:12px;">🎉 <b>${t.allSettled}</b></div>`;
    launchConfetti();
}

    // Settlement history in group view
    if ((window.currentGroup.settled || []).length > 0) {
        resultBox.innerHTML += `<p style="font-weight:bold; color:#555; font-size:13px; margin:15px 0 8px;">📋 ${t.settlementHistory}</p>`;
        [...window.currentGroup.settled].reverse().forEach(s => {
            resultBox.innerHTML += `
                <div style="background:white; padding:10px; border-radius:10px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 1px 4px rgba(0,0,0,0.04);">
                    <div>
                        <span style="font-size:13px; color:#333; font-weight:bold;">${s.member}</span>
                        <span style="font-size:11px; color:#aaa; margin-left:6px;">${s.date || ''}</span>
                    </div>
                    <span style="color:#5b8f67; font-weight:bold; font-size:13px;">✓ ${window.currentCurrency}${s.amount.toFixed(2)}</span>
                </div>`;
        });
    }
};

// ============================================================
//  SETTLEMENT HISTORY PAGE (all groups)
// ============================================================
window.renderSettlementHistory = function () {
    const container = document.getElementById('settlementHistoryContainer');
    if (!container) return;
    container.innerHTML = '';
    const allSettlements = [];
    (window.groups || []).forEach(group => {
        (group.settled || []).forEach(s => {
            allSettlements.push({ ...s, groupName: group.name });
        });
    });
    if (allSettlements.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#aaa; padding:30px;">
            <div style="font-size:36px;">📋</div><p><b>No settlements yet</b></p>
            <p style="font-size:12px;">Settled payments will appear here</p></div>`;
        return;
    }
    const totalSettled = allSettlements.reduce((s, x) => s + x.amount, 0);
    container.innerHTML = `
        <div style="background:linear-gradient(135deg,#5b8f67,#2d8cff); color:white; padding:14px; border-radius:14px; margin-bottom:16px; text-align:center;">
            <div style="font-size:11px; opacity:0.8;">Total Settled</div>
            <div style="font-size:24px; font-weight:bold;">${window.currentCurrency}${totalSettled.toFixed(2)}</div>
            <div style="font-size:11px; opacity:0.8; margin-top:4px;">${allSettlements.length} payment${allSettlements.length > 1 ? 's' : ''}</div>
        </div>`;
    // Group by group name
    const byGroup = {};
    allSettlements.forEach(s => { if (!byGroup[s.groupName]) byGroup[s.groupName] = []; byGroup[s.groupName].push(s); });
    Object.entries(byGroup).forEach(([groupName, settlements]) => {
        container.innerHTML += `<p style="font-weight:bold; color:#555; font-size:13px; margin:12px 0 6px;">👥 ${groupName}</p>`;
        settlements.forEach(s => {
            container.innerHTML += `
                <div style="background:white; padding:12px; border-radius:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                    <div>
                        <span style="font-size:13px; color:#333; font-weight:bold;">${s.member}</span><br>
                        <span style="font-size:11px; color:#aaa;">${s.date || ''} ${s.time || ''}</span>
                    </div>
                    <span style="color:#5b8f67; font-weight:bold;">✓ ${window.currentCurrency}${s.amount.toFixed(2)}</span>
                </div>`;
        });
    });
};

// ============================================================
//  ANALYTICS PAGE
// ============================================================
window.renderAnalytics = function () {
    const container = document.getElementById('analyticsContainer');
    if (!container) return;
    container.innerHTML = '';

    // Aggregate all expenses across all groups
    const allExpenses = [];
    (window.groups || []).forEach(group => {
        (group.expenses || []).forEach(exp => {
            allExpenses.push({ ...exp, groupName: group.name });
        });
    });

    if (allExpenses.length === 0) {
        container.innerHTML = `<div style="text-align:center; color:#aaa; padding:30px;">
            <div style="font-size:36px;">📊</div><p><b>No data yet</b></p>
            <p style="font-size:12px;">Add expenses to see analytics</p></div>`;
        return;
    }

    const totalAll = allExpenses.reduce((s, e) => s + e.amount, 0);

    // Summary cards
    container.innerHTML += `
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:16px;">
            <div style="background:#f0f7ff; padding:12px; border-radius:12px; text-align:center;">
                <div style="font-size:11px; color:#2d8cff; margin-bottom:4px;">Total Spend</div>
                <div style="font-size:18px; font-weight:bold; color:#2d8cff;">${window.currentCurrency}${totalAll.toFixed(2)}</div>
            </div>
            <div style="background:#f0fff4; padding:12px; border-radius:12px; text-align:center;">
                <div style="font-size:11px; color:#5b8f67; margin-bottom:4px;">Transactions</div>
                <div style="font-size:18px; font-weight:bold; color:#5b8f67;">${allExpenses.length}</div>
            </div>
        </div>`;

    // Category breakdown
    const catTotals = {};
    allExpenses.forEach(exp => {
        const cat = exp.category || '🧾 Other';
        catTotals[cat] = (catTotals[cat] || 0) + exp.amount;
    });
    const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
    container.innerHTML += `<p style="font-weight:bold; color:#555; font-size:13px; margin:0 0 8px;">📊 By Category</p>`;
    sortedCats.forEach(([cat, amt]) => {
        const pct = totalAll > 0 ? ((amt / totalAll) * 100).toFixed(1) : 0;
        const colors = { '🍔 Food': '#f97316', '🚗 Travel': '#2d8cff', '🏠 Rent': '#a855f7', '🎉 Fun': '#f7c948', '🛒 Shopping': '#d46b82', '💡 Bills': '#5b8f67' };
        const color = colors[cat] || '#888';
        container.innerHTML += `
            <div style="background:white; padding:10px 12px; border-radius:10px; margin-bottom:6px; box-shadow:0 1px 4px rgba(0,0,0,0.04);">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:13px;">
                    <span>${cat}</span>
                    <span style="font-weight:bold;">${window.currentCurrency}${amt.toFixed(2)} <span style="color:#aaa; font-weight:normal;">(${pct}%)</span></span>
                </div>
                <div style="background:#eee; border-radius:4px; height:6px;">
                    <div style="background:${color}; width:${pct}%; height:6px; border-radius:4px; transition:width 0.5s;"></div>
                </div>
            </div>`;
    });

    // Monthly summary
    const monthTotals = {};
    allExpenses.forEach(exp => {
        if (!exp.date) return;
        const parts = exp.date.split(' ');
        const key = parts.length >= 3 ? parts[1] + ' ' + parts[2] : exp.date;
        monthTotals[key] = (monthTotals[key] || 0) + exp.amount;
    });
    const sortedMonths = Object.entries(monthTotals);
    if (sortedMonths.length > 0) {
        container.innerHTML += `<p style="font-weight:bold; color:#555; font-size:13px; margin:16px 0 8px;">📅 Monthly Summary</p>`;
        sortedMonths.forEach(([month, amt]) => {
            container.innerHTML += `
                <div style="background:white; padding:10px 12px; border-radius:10px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 1px 4px rgba(0,0,0,0.04);">
                    <span style="font-size:13px; color:#555;">${month}</span>
                    <span style="font-weight:bold; color:#2d8cff;">${window.currentCurrency}${amt.toFixed(2)}</span>
                </div>`;
        });
    }

    // Top spenders across all groups
    const spenderMap = {};
    (window.groups || []).forEach(group => {
        (group.expenses || []).forEach(exp => {
            spenderMap[exp.payer] = (spenderMap[exp.payer] || 0) + exp.amount;
        });
    });
    const sortedSpenders = Object.entries(spenderMap).sort((a, b) => b[1] - a[1]);
    if (sortedSpenders.length > 0) {
        container.innerHTML += `<p style="font-weight:bold; color:#555; font-size:13px; margin:16px 0 8px;">🏆 Top Payers</p>`;
        sortedSpenders.forEach(([name, amt], i) => {
            const medals = ['🥇', '🥈', '🥉'];
            container.innerHTML += `
                <div style="background:white; padding:10px 12px; border-radius:10px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 1px 4px rgba(0,0,0,0.04);">
                    <span style="font-size:13px;">${medals[i] || '👤'} ${name}</span>
                    <span style="font-weight:bold; color:#5b8f67;">${window.currentCurrency}${amt.toFixed(2)}</span>
                </div>`;
        });
    }

    // Export button
    container.innerHTML += `
        <button onclick="exportAllCSV()" style="width:100%; padding:12px; border:2px solid #2d8cff; border-radius:12px; background:#f0f7ff; color:#2d8cff; font-weight:bold; cursor:pointer; margin-top:12px;">
            📥 Export All Data (CSV)
        </button>`;
};

// ============================================================
//  EXPORT CSV (group)
// ============================================================
window.exportGroupCSV = function () {
    if (!window.currentGroup) return;
    const rows = [['Date', 'Category', 'Name', 'Amount', 'Paid By', 'Payment Method', 'Notes', 'Split Type']];
    (window.currentGroup.expenses || []).forEach(exp => {
        rows.push([exp.date || '', exp.category || '', exp.name, exp.amount, exp.payer, exp.paymentMethod || 'UPI', exp.notes || '', exp.splitType || 'Equal']);
    });
    downloadCSV(rows, window.currentGroup.name + '_expenses.csv');
};

window.exportAllCSV = function () {
    const rows = [['Group', 'Date', 'Category', 'Name', 'Amount', 'Paid By', 'Payment Method', 'Notes']];
    (window.groups || []).forEach(group => {
        (group.expenses || []).forEach(exp => {
            rows.push([group.name, exp.date || '', exp.category || '', exp.name, exp.amount, exp.payer, exp.paymentMethod || 'UPI', exp.notes || '']);
        });
    });
    downloadCSV(rows, 'equapay_all_expenses.csv');
};

function downloadCSV(rows, filename) {
    const csvContent = rows.map(r => r.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

// ============================================================
//  THEME
// ============================================================
window.setTheme = function (mode) {
    const sidebar = document.querySelector('.sidebar');
    if (mode === 'dark') {
        document.body.classList.add('dark-mode');

        document.body.style.background = '#1a1a1a';
        document.body.style.color = 'white';
        sidebar.style.background = '#2d2d2d';
        sidebar.style.color = 'white';

    } else {
        document.body.classList.remove('dark-mode');

        document.body.style.background = '';
        document.body.style.color = '';
        sidebar.style.background = '';
        sidebar.style.color = '';
    }
    renderDashboard();
    toggleMenu();
};

// ============================================================
//  TRANSLATIONS (all 6 languages, all strings)
// ============================================================
const translations = {
    english: {
        hello: 'Hello, User 👋', welcome: 'Welcome to Equapay', getStarted: 'Get Started',
        tagline: 'Manage shared expenses without the stress.',
        yourGroups: 'Your Groups', searchGroups: 'Search groups...',
        newGroup: 'New Group', settings: 'Settings', groups: 'Groups',
        darkMode: 'Dark mode', lightMode: 'Light mode', language: 'Language',
        notifications: 'Notifications', logout: 'Logout',
        addExpense: 'Add Expense', itemName: 'e.g. Electricity', whoPaid: 'Who Paid?',
        amount: 'Amount', confirmSplit: 'Confirm Split',
        expenseHistory: 'Expense History', settleUp: 'Settle Up',
        noExpenses: 'No expenses yet', tapToAdd: 'Tap + to add one',
        allSettled: 'All settled up!', settle: 'Settle ✓', paid: 'paid', owes: 'owes',
        members: 'members', expenses: 'expenses',
        groupName: 'e.g., Weekend Trip', groupMembers: 'Add names (e.g. Sidra, Sania)',
        description: 'What is this group for?', createGroup: 'Create Group',
        noGroups: 'No groups yet', tapToCreate: 'Tap + to create your first group',
        groupNameLabel: 'Group Name:', groupMembersLabel: 'Group Members:',
        groupDescLabel: 'Description (optional):', itemNameLabel: 'Item Name:',
        totalSpent: 'Total Spent', perPerson: 'Per Person',
        paymentBreakdown: 'Payment Breakdown',
        settlementHistory: 'Settlement History',
        currency: 'Currency', splitType: 'Split type',
    },
    hindi: {
        hello: 'नमस्ते, उपयोगकर्ता 👋', welcome: 'Equapay में आपका स्वागत है', getStarted: 'शुरू करें',
        tagline: 'बिना तनाव के साझा खर्च प्रबंधित करें।',
        yourGroups: 'आपके समूह', searchGroups: 'समूह खोजें...',
        newGroup: 'नया समूह', settings: 'सेटिंग्स', groups: 'समूह',
        darkMode: 'डार्क मोड', lightMode: 'लाइट मोड', language: 'भाषा',
        notifications: 'सूचनाएं', logout: 'लॉगआउट',
        addExpense: 'खर्च जोड़ें', itemName: 'जैसे बिजली', whoPaid: 'किसने भुगतान किया?',
        amount: 'राशि', confirmSplit: 'विभाजन की पुष्टि करें',
        expenseHistory: 'खर्च इतिहास', settleUp: 'भुगतान करें',
        noExpenses: 'अभी तक कोई खर्च नहीं', tapToAdd: '+ दबाएं जोड़ने के लिए',
        allSettled: 'सब भुगतान हो गया!', settle: 'भुगतान ✓', paid: 'ने भुगतान किया', owes: 'बकाया',
        members: 'सदस्य', expenses: 'खर्च',
        groupName: 'जैसे, वीकेंड ट्रिप', groupMembers: 'नाम जोड़ें',
        description: 'यह समूह किसके लिए है?', createGroup: 'समूह बनाएं',
        noGroups: 'अभी कोई समूह नहीं', tapToCreate: '+ दबाएं पहला समूह बनाने के लिए',
        groupNameLabel: 'समूह का नाम:', groupMembersLabel: 'सदस्य:',
        groupDescLabel: 'विवरण (वैकल्पिक):', itemNameLabel: 'वस्तु का नाम:',
        totalSpent: 'कुल खर्च', perPerson: 'प्रति व्यक्ति',
        paymentBreakdown: 'भुगतान विवरण', settlementHistory: 'भुगतान इतिहास',
        currency: 'मुद्रा', splitType: 'विभाजन',
        analytics: 'एनालिटिक्स',
notesOptional: 'नोट्स (वैकल्पिक)',
addNote: 'नोट जोड़ें...',
date: 'तारीख',
rememberMe: 'मुझे याद रखें',
forgotPassword: 'पासवर्ड भूल गए?',
resetPassword: 'पासवर्ड रीसेट',
sendResetEmail: 'रीसेट ईमेल भेजें'
    },
    telugu: {
        hello: 'హలో, వినియోగదారు 👋', welcome: 'Equapay కి స్వాగతం', getStarted: 'ప్రారంభించండి',
        tagline: 'ఒత్తిడి లేకుండా భాగస్వామ్య ఖర్చులు నిర్వహించండి.',
        yourGroups: 'మీ గ్రూప్లు', searchGroups: 'గ్రూప్లు వెతకండి...',
        newGroup: 'కొత్త గ్రూప్', settings: 'సెట్టింగులు', groups: 'గ్రూప్లు',
        darkMode: 'డార్క్ మోడ్', lightMode: 'లైట్ మోడ్', language: 'భాష',
        notifications: 'నోటిఫికేషన్లు', logout: 'లాగ్అవుట్',
        addExpense: 'ఖర్చు జోడించండి', itemName: 'ఉదా. విద్యుత్', whoPaid: 'ఎవరు చెల్లించారు?',
        amount: 'మొత్తం', confirmSplit: 'విభజనను నిర్ధారించండి',
        expenseHistory: 'ఖర్చుల చరిత్ర', settleUp: 'సెటిల్ చేయండి',
        noExpenses: 'ఇంకా ఖర్చులు లేవు', tapToAdd: '+ నొక్కి జోడించండి',
        allSettled: 'అన్నీ చెల్లిపోయాయి!', settle: 'సెటిల్ ✓', paid: 'చెల్లించారు', owes: 'బాకీ',
        members: 'సభ్యులు', expenses: 'ఖర్చులు',
        groupName: 'ఉదా., వీకెండ్ ట్రిప్', groupMembers: 'పేర్లు జోడించండి',
        description: 'ఈ గ్రూప్ దేని కోసం?', createGroup: 'గుంపును సృష్టించండి',
        noGroups: 'ఇంకా గుంపులు లేవు', tapToCreate: '+ నొక్కి మొదటి గుంపు సృష్టించండి',
        groupNameLabel: 'గ్రూప్ పేరు:', groupMembersLabel: 'గ్రూప్ సభ్యులు:',
        groupDescLabel: 'వివరణ (ఐచ్ఛికం):', itemNameLabel: 'వస్తువు పేరు:',
        totalSpent: 'మొత్తం ఖర్చు', perPerson: 'తలసరి',
        paymentBreakdown: 'చెల్లింపు వివరాలు', settlementHistory: 'సెటిల్మెంట్ చరిత్ర',
        currency: 'కరెన్సీ', splitType: 'విభజన',telugu: {
        analytics: 'విశ్లేషణలు',
settlementHistoryTitle: 'సెటిల్మెంట్ చరిత్ర',
notesOptional: 'గమనికలు (ఐచ్ఛికం)',
addNote: 'గమనికను జోడించండి...',
date: 'తేదీ',
rememberMe: 'నన్ను గుర్తుంచుకోండి',
forgotPassword: 'పాస్‌వర్డ్ మర్చిపోయారా?',
resetPassword: 'పాస్‌వర్డ్ రీసెట్',
sendResetEmail: 'రీసెట్ ఇమెయిల్ పంపండి'
},
    },
    urdu: {
        hello: 'ہیلو، صارف 👋', welcome: 'Equapay میں خوش آمدید', getStarted: 'شروع کریں',
        tagline: 'بغیر تناؤ کے مشترکہ اخراجات کا انتظام کریں۔',
        yourGroups: 'آپ کے گروپ', searchGroups: 'گروپ تلاش کریں...',
        newGroup: 'نیا گروپ', settings: 'ترتیبات', groups: 'گروپ',
        darkMode: 'ڈارک موڈ', lightMode: 'لائٹ موڈ', language: 'زبان',
        notifications: 'اطلاعات', logout: 'لاگ آؤٹ',
        addExpense: 'خرچ شامل کریں', itemName: 'مثلاً بجلی', whoPaid: 'کس نے ادا کیا؟',
        amount: 'رقم', confirmSplit: 'تقسیم کی تصدیق کریں',
        expenseHistory: 'خرچ کی تاریخ', settleUp: 'ادائیگی کریں',
        noExpenses: 'ابھی کوئی خرچ نہیں', tapToAdd: '+ دبائیں شامل کرنے کے لیے',
        allSettled: 'سب ادا ہو گیا!', settle: 'ادا کریں ✓', paid: 'نے ادا کیا', owes: 'مقروض',
        members: 'اراکین', expenses: 'اخراجات',
        groupName: 'مثلاً، ویک اینڈ ٹرپ', groupMembers: 'نام شامل کریں',
        description: 'یہ گروپ کس لیے ہے؟', createGroup: 'گروپ بنائیں',
        noGroups: 'ابھی کوئی گروپ نہیں', tapToCreate: '+ دبائیں پہلا گروپ بنانے کے لیے',
        groupNameLabel: 'گروپ کا نام:', groupMembersLabel: 'اراکین:',
        groupDescLabel: 'تفصیل (اختیاری):', itemNameLabel: 'چیز کا نام:',
        totalSpent: 'کل خرچ', perPerson: 'فی شخص',
        paymentBreakdown: 'ادائیگی کی تفصیل', settlementHistory: 'ادائیگی تاریخ',
        currency: 'کرنسی', splitType: 'تقسیم',
        analytics: 'تجزیات',
notesOptional: 'نوٹس (اختیاری)',
addNote: 'نوٹ شامل کریں...',
date: 'تاریخ',
rememberMe: 'مجھے یاد رکھیں',
forgotPassword: 'پاس ورڈ بھول گئے؟',
resetPassword: 'پاس ورڈ ری سیٹ',
sendResetEmail: 'ری سیٹ ای میل بھیجیں'
    },
    tamil: {
        hello: 'வணக்கம், பயனர் 👋', welcome: 'Equapay க்கு வரவேற்கிறோம்', getStarted: 'தொடங்கு',
        tagline: 'மன அழுத்தமின்றி பகிர்ந்த செலவுகளை நிர்வகிக்கவும்.',
        yourGroups: 'உங்கள் குழுக்கள்', searchGroups: 'குழுக்களை தேடு...',
        newGroup: 'புதிய குழு', settings: 'அமைப்புகள்', groups: 'குழுக்கள்',
        darkMode: 'இருண்ட முறை', lightMode: 'ஒளி முறை', language: 'மொழி',
        notifications: 'அறிவிப்புகள்', logout: 'வெளியேறு',
        addExpense: 'செலவு சேர்க்கவும்', itemName: 'எ.கா. மின்சாரம்', whoPaid: 'யார் செலுத்தினார்?',
        amount: 'தொகை', confirmSplit: 'பிரிவை உறுதி செய்யவும்',
        expenseHistory: 'செலவு வரலாறு', settleUp: 'தீர்வு செய்யவும்',
        noExpenses: 'இன்னும் செலவுகள் இல்லை', tapToAdd: '+ அழுத்தி சேர்க்கவும்',
        allSettled: 'அனைத்தும் தீர்க்கப்பட்டது!', settle: 'தீர்க்க ✓', paid: 'செலுத்தினார்', owes: 'கடன்',
        members: 'உறுப்பினர்கள்', expenses: 'செலவுகள்',
        groupName: 'எ.கா., வார இறுதி பயணம்', groupMembers: 'பெயர்களை சேர்க்கவும்',
        description: 'இந்த குழு எதற்காக?', createGroup: 'குழு உருவாக்கு',
        noGroups: 'குழுக்கள் இல்லை', tapToCreate: '+ அழுத்தி முதல் குழு உருவாக்கவும்',
        groupNameLabel: 'குழு பெயர்:', groupMembersLabel: 'உறுப்பினர்கள்:',
        groupDescLabel: 'விளக்கம் (விரும்பினால்):', itemNameLabel: 'பொருள் பெயர்:',
        totalSpent: 'மொத்த செலவு', perPerson: 'தனி நபர்',
        paymentBreakdown: 'கட்டண விவரம்', settlementHistory: 'தீர்வு வரலாறு',
        currency: 'நாணயம்', splitType: 'பிரிவு வகை',
        analytics: 'பகுப்பாய்வு',
notesOptional: 'குறிப்புகள் (விருப்பத்தேர்வு)',
addNote: 'ஒரு குறிப்பைச் சேர்க்கவும்...',
date: 'தேதி',
rememberMe: 'என்னை நினைவில் கொள்ளவும்',
forgotPassword: 'கடவுச்சொல்லை மறந்துவிட்டீர்களா?',
resetPassword: 'கடவுச்சொல் மீட்டமை',
sendResetEmail: 'மீட்டமைப்பு மின்னஞ்சல் அனுப்பு'
    },
    kannada: {
        hello: 'ಹಲೋ, ಬಳಕೆದಾರ 👋', welcome: 'Equapay ಗೆ ಸ್ವಾಗತ', getStarted: 'ಪ್ರಾರಂಭಿಸಿ',
        tagline: 'ಒತ್ತಡವಿಲ್ಲದೆ ಹಂಚಿದ ಖರ್ಚುಗಳನ್ನು ನಿರ್ವಹಿಸಿ.',
        yourGroups: 'ನಿಮ್ಮ ಗುಂಪುಗಳು', searchGroups: 'ಗುಂಪುಗಳನ್ನು ಹುಡುಕಿ...',
        newGroup: 'ಹೊಸ ಗುಂಪು', settings: 'ಸೆಟ್ಟಿಂಗ್‌ಗಳು', groups: 'ಗುಂಪುಗಳು',
        darkMode: 'ಡಾರ್ಕ್ ಮೋಡ್', lightMode: 'ಲೈಟ್ ಮೋಡ್', language: 'ಭಾಷೆ',
        notifications: 'ಅಧಿಸೂಚನೆಗಳು', logout: 'ಲಾಗ್ ಔಟ್',
        addExpense: 'ಖರ್ಚು ಸೇರಿಸಿ', itemName: 'ಉದಾ. ವಿದ್ಯುತ್', whoPaid: 'ಯಾರು ಪಾವತಿಸಿದರು?',
        amount: 'ಮೊತ್ತ', confirmSplit: 'ವಿಭಜನೆ ದೃಢಪಡಿಸಿ',
        expenseHistory: 'ಖರ್ಚಿನ ಇತಿಹಾಸ', settleUp: 'ಸೆಟಲ್ ಮಾಡಿ',
        noExpenses: 'ಇನ್ನೂ ಖರ್ಚುಗಳಿಲ್ಲ', tapToAdd: '+ ಒತ್ತಿ ಸೇರಿಸಿ',
        allSettled: 'ಎಲ್ಲಾ ಸೆಟಲ್ ಆಗಿದೆ!', settle: 'ಸೆಟಲ್ ✓', paid: 'ಪಾವತಿಸಿದರು', owes: 'ಬಾಕಿ',
        members: 'ಸದಸ್ಯರು', expenses: 'ಖರ್ಚುಗಳು',
        groupName: 'ಉದಾ., ವೀಕೆಂಡ್ ಟ್ರಿಪ್', groupMembers: 'ಹೆಸರುಗಳನ್ನು ಸೇರಿಸಿ',
        description: 'ಈ ಗುಂಪು ಯಾಕಾಗಿ?', createGroup: 'ಗುಂಪು ರಚಿಸಿ',
        noGroups: 'ಯಾವುದೇ ಗುಂಪುಗಳಿಲ್ಲ', tapToCreate: '+ ಒತ್ತಿ ಮೊದಲ ಗುಂಪು ರಚಿಸಿ',
        groupNameLabel: 'ಗುಂಪಿನ ಹೆಸರು:', groupMembersLabel: 'ಸದಸ್ಯರು:',
        groupDescLabel: 'ವಿವರಣೆ (ಐಚ್ಛಿಕ):', itemNameLabel: 'ವಸ್ತುವಿನ ಹೆಸರು:',
        totalSpent: 'ಒಟ್ಟು ಖರ್ಚು', perPerson: 'ಪ್ರತಿ ವ್ಯಕ್ತಿ',
        paymentBreakdown: 'ಪಾವತಿ ವಿವರ', settlementHistory: 'ಸೆಟಲ್ ಇತಿಹಾಸ',
        currency: 'ಕರೆನ್ಸಿ', splitType: 'ವಿಭಜನೆ ಪ್ರಕಾರ',
        analytics: 'ವಿಶ್ಲೇಷಣೆ',
notesOptional: 'ಟಿಪ್ಪಣಿಗಳು (ಐಚ್ಛಿಕ)',
addNote: 'ಟಿಪ್ಪಣಿ ಸೇರಿಸಿ...',
date: 'ದಿನಾಂಕ',
rememberMe: 'ನನ್ನನ್ನು ನೆನಪಿಡಿ',
forgotPassword: 'ಪಾಸ್‌ವರ್ಡ್ ಮರೆತಿರಾ?',
resetPassword: 'ಪಾಸ್‌ವರ್ಡ್ ಮರುಹೊಂದಿಸಿ',
sendResetEmail: 'ಮರುಹೊಂದಿಸುವ ಇಮೇಲ್ ಕಳುಹಿಸಿ'
    }
};

// ============================================================
//  APPLY LANGUAGE (all pages, all elements)
// ============================================================
window.applyLanguage = function (lang) {
    currentLang = lang;
    const t = translations[lang];
    const safe = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
    const safeQ = (sel, text) => { const el = document.querySelector(sel); if (el) el.textContent = text; };
    const safePH = (id, text) => { const el = document.getElementById(id); if (el) el.placeholder = text; };

    safeQ('#welcomeHello', t.hello);
    safeQ('#welcomeSubtitle', t.welcome);
    safeQ('#welcomeStartBtn', t.getStarted);
    safe('loginTagline', t.tagline);
    safe('dashYourGroups', t.yourGroups);
    safePH('dashSearch', t.searchGroups);
    safe('newGroupTitle', t.newGroup);
    safePH('groupInput', t.groupName);
    safePH('groupMembers', t.groupMembers);
    safePH('groupDesc', t.description);
    safe('createGroupBtn', t.createGroup);
    safe('addExpenseTitle', t.addExpense);
    safePH('expName', t.itemName);
    safe('amountLabel', t.amount);
    safe('confirmSplitBtn', t.confirmSplit);
    safe('whoPaidLabel', t.whoPaid);
    safe('itemNameLabel', t.itemNameLabel);
    safe('groupNameLabel', t.groupNameLabel);
    safe('groupMembersLabel', t.groupMembersLabel);
    safe('groupDescLabel', t.groupDescLabel);
    safe('sidebarSettings', t.settings);
    safe('sidebarGroups', t.groups);
    safe('sidebarDark', t.darkMode);
    safe('sidebarLight', t.lightMode);
    safe('sidebarLanguage', t.language);
    safe('sidebarLogout', t.logout);
    safe('noGroupsText', t.noGroups);
    safe('noGroupsHint', t.tapToCreate);
    safe('currencyLabel', t.currency);
    safe('splitTypeLabel2', t.splitType);
    const sidebarNotif = document.getElementById('sidebarNotif');
    if (sidebarNotif) sidebarNotif.innerHTML = t.notifications + ' <span class="float-right">' + (window.notificationsEnabled ? 'ON' : 'OFF') + '</span>';

    // Payment Method label
    safe('paymentMethodLabel', lang === 'hindi' ? 'भुगतान विधि' : lang === 'telugu' ? 'చెల్లింపు పదతి' : lang === 'urdu' ? 'ادائیگی کا طریقہ' : lang === 'tamil' ? 'கட்டண முறை' : lang === 'kannada' ? 'ಪಾವತಿ ವಿಧಾನ' : 'Payment Method');
    safe('categoryLabel', lang === 'hindi' ? 'श्रेणी' : lang === 'telugu' ? 'వర్గం' : lang === 'urdu' ? 'زمرہ' : lang === 'tamil' ? 'வகை' : lang === 'kannada' ? 'ವರ್ಗ' : 'Category');
    safe('scanReceiptBtn', lang === 'hindi' ? '📸 रसीद स्कैन करें' : lang === 'telugu' ? '📸 రసీదు స్కాన్ చేయండి' : lang === 'urdu' ? '📸 رسید اسکین کریں' : lang === 'tamil' ? '📸 ரசீது ஸ்கேன் செய்யவும்' : lang === 'kannada' ? '📸 ರಸೀದಿ ಸ್ಕ್ಯಾನ್ ಮಾಡಿ' : '📸 Scan Receipt Instead');

    const splitLabels = {
        english: ['⚖️ Equal', '📊 Percent', '✏️ Exact', '🔢 Shares'],
        hindi: ['⚖️ बराबर', '📊 प्रतिशत', '✏️ सटीक', '🔢 हिस्से'],
        telugu: ['⚖️ సమాన', '📊 శాతం', '✏️ ఖచ్చితం', '🔢 వాటాలు'],
        urdu: ['⚖️ برابر', '📊 فیصد', '✏️ عین', '🔢 حصے'],
        tamil: ['⚖️ சமம்', '📊 சதவீதம்', '✏️ சரியான', '🔢 பங்குகள்'],
        kannada: ['⚖️ ಸಮಾನ', '📊 ಶೇಕಡಾ', '✏️ ನಿಖರ', '🔢 ಪಾಲುಗಳು']
    };
    const labels = splitLabels[lang] || splitLabels['english'];
    ['Equal', 'Percentage', 'Exact', 'Share'].forEach((type, i) => {
        const btn = document.getElementById('splitBtn' + type);
        if (btn) btn.textContent = labels[i];
    });

    const splitTypeNames = { english: 'Split Type', hindi: 'विभाजन प्रकार', telugu: 'విభజన రకం', urdu: 'تقسیم کی قسم', tamil: 'பிரிவு வகை', kannada: 'ವಿಭಜನೆ ಪ್ರಕಾರ' };
    safe('splitTypeLabel', splitTypeNames[lang] || 'Split Type');

    const splitOptions = {
        english: ['Equal', 'Percentage', 'Exact Amount', 'By Shares'],
        hindi: ['बराबर', 'प्रतिशत', 'सटीक राशि', 'हिस्सों से'],
        telugu: ['సమాన', 'శాతం', 'ఖచ్చిత మొత్తం', 'వాటాల ద్వారా'],
        urdu: ['برابر', 'فیصد', 'عین رقم', 'حصوں سے'],
        tamil: ['சமம்', 'சதவீதம்', 'சரியான தொகை', 'பங்குகள் மூலம்'],
        kannada: ['ಸಮಾನ', 'ಶೇಕಡಾ', 'ನಿಖರ ಮೊತ್ತ', 'ಪಾಲುಗಳಿಂದ']
    };
    const opts = splitOptions[lang] || splitOptions['english'];
    ['Equal', 'Percentage', 'Exact', 'Share'].forEach((id, i) => { const el = document.getElementById('opt' + id); if (el) el.textContent = opts[i]; });
    safe('analyticsTitle', t.analytics);
safe('settlementHistoryTitlePage', t.settlementHistoryTitle);
safe('notesLabel', t.notesOptional);
safePH('expNotes', t.addNote);
safe('dateLabel', t.date);
safe('rememberMeLabel', t.rememberMe);
safe('forgotPasswordLink', t.forgotPassword);
safe('resetPasswordTitle', t.resetPassword);
safe('sendResetBtn', t.sendResetEmail);

    showLanguagePicker(false);
    renderDashboard();
    if (window.currentGroup) { renderChart(); renderExpenseLog(); }
};

// ============================================================
//  NOTIFICATIONS
// ============================================================
window.toggleNotifications = function () {
    const span = document.querySelector('#sidebarNotif span');
    window.notificationsEnabled = !window.notificationsEnabled;
    if (span) span.textContent = window.notificationsEnabled ? 'ON' : 'OFF';
    if (window.notificationsEnabled) {
        Notification.requestPermission().then(perm => {
            if (perm === 'granted') {
                new Notification('Equapay Notifications ON', {
                    body: 'You will be reminded when members owe money.',
                    icon: 'logo.png'
                });
            }
        });
    }
};

window.renderNotifLog = function () {
    const panel = document.getElementById('notifLogPanel');
    const list = document.getElementById('notifLogList');
    if (!panel || !list) return;
    if (window.notificationLog.length === 0) {
        list.innerHTML = '<p style="color:#aaa; font-size:12px; text-align:center; margin:0;">No reminders sent yet</p>';
    } else {
        list.innerHTML = window.notificationLog.slice().reverse().map(n =>
            `<div style="display:flex; gap:8px; align-items:flex-start; padding:6px 0; border-bottom:1px solid #f7c94833;">
                <span style="font-size:16px;">🔔</span>
                <div style="flex:1;">
                    <div style="font-weight:bold; color:#333; font-size:12px;">${n.member}</div>
                    <div style="font-size:11px; color:#555;">${n.message}</div>
                </div>
                <div style="font-size:10px; color:#aaa; white-space:nowrap;">${n.time}</div>
            </div>`
        ).join('');
    }
    panel.style.display = 'block';
};

window.notifyOwed = function () {
    if (!window.notificationsEnabled) { alert('Turn on notifications in settings first!'); return; }
    if (!window.currentGroup) { alert('Open a group first!'); return; }
    const owedMap = {};
    window.currentGroup.members.forEach(m => owedMap[m] = 0);
    (window.currentGroup.expenses || []).forEach(exp => {
        window.currentGroup.members.forEach(m => {
            if (m !== exp.payer) {
                const amt = exp.splits ? exp.splits[m] : (exp.amount / window.currentGroup.members.length);
                owedMap[m] += amt || 0;
            }
        });
    });
    (window.currentGroup.settled || []).forEach(s => { owedMap[s.member] = Math.max(0, owedMap[s.member] - s.amount); });
    const debtors = Object.entries(owedMap).filter(([, amt]) => amt > 0.01);
    if (debtors.length === 0) { alert('Everyone is settled up! 🎉'); return; }
    const now = new Date();
    const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    debtors.forEach(([member, amt]) => {
        const message = `${member} owes ${window.currentCurrency}${amt.toFixed(2)} in ${window.currentGroup.name}`;
        window.notificationLog.push({ member, message, time: timeStr });
    });
    window.renderNotifLog();
    if (Notification.permission === 'granted') {
        debtors.forEach(([member, amt]) => {
            new Notification(`💸 ${member} owes money!`, {
                body: `${member} owes ${window.currentCurrency}${amt.toFixed(2)} in ${window.currentGroup.name}`,
                icon: 'logo.png'
            });
        });
    } else {
        Notification.requestPermission().then(perm => {
            if (perm === 'granted') {
                debtors.forEach(([member, amt]) => {
                    new Notification(`💸 ${member} owes money!`, {
                        body: `${member} owes ${window.currentCurrency}${amt.toFixed(2)} in ${window.currentGroup.name}`,
                        icon: 'logo.png'
                    });
                });
            } else {
                alert(debtors.map(([m, a]) => `${m} owes ${window.currentCurrency}${a.toFixed(2)}`).join('\n'));
            }
        });
    }
    updateNotifBadge();
};

// ============================================================
//  UTILITY
// ============================================================
window.showLanguagePicker = function (show) {
    const el = document.getElementById('languagePicker');
    if (el) el.style.display = show ? 'block' : 'none';
};
window.changeCurrency = function (symbol) {
    window.currentCurrency = symbol;
    renderDashboard();
    if (window.currentGroup) { renderChart(); renderExpenseLog(); }
};
window.changeSplit = function (type) { currentSplitType = type; };

window.confirmDeleteExpense = function (index) {
    if (confirm('Delete this expense?')) window.deleteExpense(window.currentGroup.id, index);
};
window.openEditExpenseModal = function (index) {
    const exp = window.currentGroup.expenses[index];
    document.getElementById('editExpenseName').value = exp.name;
    document.getElementById('editExpenseAmount').value = exp.amount;
    document.getElementById('editExpenseModal').style.display = 'block';
};
window.saveEditedExpense = function () {
    const index = parseInt(document.getElementById('editExpenseModal').dataset.index);
    const newName = document.getElementById('editExpenseName').value;
    const newAmt = parseFloat(document.getElementById('editExpenseAmount').value);
    if (!newName || !newAmt || newAmt <= 0) return;
    const updated = { ...exp, name: newName, amount: newAmt };
    window.editExpense(window.currentGroup.id, index, updated);
};
window.shareExpenseSummary = function () {
    if (!window.currentGroup) return;
    const lines = [`📋 ${window.currentGroup.name} — Expense Summary\n`];
    (window.currentGroup.expenses || []).forEach(exp => {
        lines.push(`• ${exp.name}: ${window.currentCurrency}${exp.amount} (paid by ${exp.payer} via ${exp.paymentMethod || 'UPI'})`);
    });
    const total = (window.currentGroup.expenses || []).reduce((s, e) => s + e.amount, 0);
    lines.push(`\nTotal: ${window.currentCurrency}${total.toFixed(2)}`);
    const text = lines.join('\n');
    if (navigator.share) navigator.share({ title: window.currentGroup.name, text });
    else navigator.clipboard.writeText(text).then(() => alert('Summary copied to clipboard!'));
};
window.confirmDeleteGroup = function () {
    if (confirm('Delete this entire group? This cannot be undone.')) window.deleteGroup(window.currentGroup.id);
};

window.showEditMembers = function () {
    const panel = document.getElementById('editMembersPanel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
    if (panel.style.display === 'block') {
        window._editingMembers = [...window.currentGroup.members];
        renderMemberChips();
        document.getElementById('editUsernameInput').value = '';
        document.getElementById('usernameLookupResult').textContent = '';
    }
};

window.renderMemberChips = function () {
    const container = document.getElementById('currentMembersList');
    if (!container) return;
    container.innerHTML = window._editingMembers.map((m, i) =>
        `<div class="member-tag">${m}<button onclick="window.removeMemberChip(${i})" title="Remove">✕</button></div>`
    ).join('');
};

window.removeMemberChip = function (index) {
    window._editingMembers.splice(index, 1);
    renderMemberChips();
};

window.lookupUsername = function (val) {
    const result = document.getElementById('usernameLookupResult');
    const username = val.trim().replace(/^@/, '').toLowerCase();
    if (!username || username.length < 2) { result.textContent = ''; return; }
    result.style.color = '#aaa'; result.textContent = '🔍 Looking up...';
    if (window.lookupUserByUsername) {
        window.lookupUserByUsername(username).then(user => {
            if (user) { result.style.color = '#5b8f67'; result.textContent = `✓ Found: ${user.name} (@${user.username})`; window._lookedUpUser = user; }
            else { result.style.color = '#d46b82'; result.textContent = `✗ Username @${username} not found`; window._lookedUpUser = null; }
        });
    }
};

window.addMemberFromUsername = function () {
    const input = document.getElementById('editUsernameInput').value.trim().replace(/^@/, '');
    const result = document.getElementById('usernameLookupResult');
    if (!input) { result.style.color = '#d46b82'; result.textContent = 'Enter a username first'; return; }
    if (window._lookedUpUser && window._lookedUpUser.username.toLowerCase() === input.toLowerCase()) {
        const name = window._lookedUpUser.name;
        if (!window._editingMembers.includes(name)) {
            window._editingMembers.push(name); renderMemberChips();
            result.style.color = '#5b8f67'; result.textContent = `✓ Added ${name}`;
            document.getElementById('editUsernameInput').value = ''; window._lookedUpUser = null;
        } else { result.style.color = '#d46b82'; result.textContent = `${name} is already in the group`; }
    } else {
        const name = input;
        if (name && !window._editingMembers.includes(name)) {
            window._editingMembers.push(name); renderMemberChips();
            result.style.color = '#5b8f67'; result.textContent = `✓ Added ${name}`;
            document.getElementById('editUsernameInput').value = '';
        } else if (window._editingMembers.includes(name)) {
            result.style.color = '#d46b82'; result.textContent = `${name} is already in the group`;
        } else { result.style.color = '#d46b82'; result.textContent = 'Search for a username first'; }
    }
};

window.saveEditedMembers = function () {
    if (!window._editingMembers || window._editingMembers.length === 0) { alert('Please add at least one member'); return; }
    window.updateGroupMembers(window.currentGroup.id, window._editingMembers);
    document.getElementById('editMembersPanel').style.display = 'none';
};

window.selectCategory = function (btn, value) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('categorySelect').value = value;
};
window.showLoading = function () { const s = document.getElementById('loadingSpinner'); if (s) s.style.display = 'block'; };
window.hideLoading = function () { const s = document.getElementById('loadingSpinner'); if (s) s.style.display = 'none'; };
window.launchConfetti = function () {
    const colors = ['#2d8cff', '#5b8f67', '#d46b82', '#f7c948', '#a855f7'];
    for (let i = 0; i < 60; i++) {
        const dot = document.createElement('div');
        dot.style.cssText = `position:fixed; width:8px; height:8px; border-radius:50%;
            background:${colors[Math.floor(Math.random() * colors.length)]};
            left:${Math.random() * 100}vw; top:-10px;
            animation: fall ${1.5 + Math.random()}s linear forwards; z-index:9999;`;
        document.body.appendChild(dot);
        setTimeout(() => dot.remove(), 2500);
    }
};
window.filterExpenses = function (query) {
    document.querySelectorAll('.expense-item-card').forEach(card => {
        card.style.display = card.textContent.toLowerCase().includes(query.toLowerCase()) ? 'block' : 'none';
    });
};