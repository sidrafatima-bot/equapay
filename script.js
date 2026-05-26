window.groups = [];
window.currentGroup = null;
let currentCurrency = '₹';
let currentSplitType = 'Equal';
let currentLang = 'english';
let notificationsEnabled = true;

window.showPage = function (id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    const sidebar = document.getElementById('sidebar');
    if (sidebar.classList.contains('open')) toggleMenu();
    const bottomNav = document.getElementById('bottomNav');
    if (bottomNav) {
        bottomNav.style.display = ['welcome', 'login'].includes(id) ? 'none' : 'flex';
    }
};

window.toggleMenu = function () {
    const s = document.getElementById('sidebar');
    const o = document.getElementById('overlay');
    s.classList.toggle('open');
    o.style.display = s.classList.contains('open') ? 'block' : 'none';
};

window.addExpenseFromNav = function() {
    if (window.currentGroup) {
        window.showPage('addExpense');
    } else {
        alert('Please open a group first!');
    }
};

window.addNewGroup = async function () {
    const groupName = document.getElementById('groupInput').value.trim();
    const membersInput = document.getElementById('groupMembers').value.trim();
    if (!groupName || !membersInput) { alert("Please enter group name and members"); return; }
    const membersArray = membersInput.split(',').map(m => m.trim());
    const newGroup = { name: groupName, members: membersArray, expenses: [], settled: [] };
    const id = await window.saveGroup(newGroup);
    newGroup.id = id;
    window.groups.push(newGroup);
    document.getElementById('groupInput').value = "";
    document.getElementById('groupMembers').value = "";
    document.getElementById('groupDesc').value = "";
    renderDashboard();
    showPage('dashboard');
};

window.renderDashboard = function () {
    const list = document.getElementById('groupList');
    const noMsg = document.getElementById('noGroupsMsg');
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
            <b class="${total > 0 ? 'red' : 'grey'}">${currentCurrency}${total}</b>`;
        card.onclick = () => openGroup(index, group.id);
        const isDark = document.querySelector('.phone').style.background === 'rgb(26, 26, 26)';
        if (isDark) { card.style.background = '#2d2d2d'; card.style.color = 'white'; }
        else { card.style.background = 'white'; card.style.color = '#333'; }
        list.appendChild(card);
    });
    document.querySelector('.search-bar').oninput = function () {
        const query = this.value.toLowerCase();
        const cards = list.querySelectorAll('.expense-card');
        cards.forEach(card => {
            const name = card.querySelector('strong').textContent.toLowerCase();
            card.style.display = name.includes(query) ? 'flex' : 'none';
        });
    };
};

window.openGroup = async function (index, id) {
    showLoading();
    let group = window.groups[index];
    if (!group || (id && group.id !== id)) group = window.groups.find(g => g.id === id);
    if (!group) { alert("Group not found, please refresh."); return; }
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
        msg.textContent = 'Must add up to ' + currentCurrency + amt;
        window.currentGroup.members.forEach(member => {
            container.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-size:13px; width:80px;">${member}</span>
                <div style="display:flex; align-items:center; gap:4px;">
                    <span style="font-size:13px;">${currentCurrency}</span>
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
        msg.textContent = Math.abs(diff) < 0.01 ? '✓ Total matches!' : currentCurrency + diff + ' remaining';
    } else if (currentSplitType === 'Share') {
        const totalShares = window.currentGroup.members.reduce((s, m) => s + (parseFloat(document.getElementById('input_' + m)?.value) || 1), 0);
        msg.style.color = '#5b8f67';
        msg.textContent = 'Total shares: ' + totalShares;
    }
};

window.calculateSplit = async function () {
    const amt = parseFloat(document.getElementById('mainAmount').value);
    const name = document.getElementById('expName').value.trim();
    const payer = document.getElementById('payerSelect').value;
    if (!amt || !name || !window.currentGroup) { alert("Please enter item name and amount"); return; }
    let splits = {};
    if (currentSplitType === 'Equal') {
        const per = amt / window.currentGroup.members.length;
        window.currentGroup.members.forEach(m => splits[m] = per);
    } else if (currentSplitType === 'Percentage') {
        let total = 0;
        window.currentGroup.members.forEach(m => { const pct = parseFloat(document.getElementById('input_' + m)?.value) || 0; splits[m] = (pct / 100) * amt; total += pct; });
        if (Math.abs(total - 100) > 1) { alert("Percentages must add up to 100%"); return; }
    } else if (currentSplitType === 'Exact') {
        let total = 0;
        window.currentGroup.members.forEach(m => { splits[m] = parseFloat(document.getElementById('input_' + m)?.value) || 0; total += splits[m]; });
        if (Math.abs(total - amt) > 0.01) { alert("Amounts don't add up to " + currentCurrency + amt); return; }
    } else if (currentSplitType === 'Share') {
        let totalShares = 0;
        window.currentGroup.members.forEach(m => { totalShares += parseFloat(document.getElementById('input_' + m)?.value) || 1; });
        window.currentGroup.members.forEach(m => { const s = parseFloat(document.getElementById('input_' + m)?.value) || 1; splits[m] = (s / totalShares) * amt; });
    }
    const category = document.getElementById('categorySelect').value;
    const date = new Date().toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'});
    const expense = { name, amount: amt, payer, splits, splitType: currentSplitType, category, date };
    window.currentGroup.expenses.push(expense);
    await window.saveExpense(window.currentGroup.id, expense);
    document.getElementById('expName').value = '';
    document.getElementById('mainAmount').value = '';
    selectSplitType('Equal');
    renderChart();
    renderExpenseLog();
    renderDashboard();
    showPage('apartment');
};

window.settleUp = async function (member, amount) {
    if (!window.currentGroup.settled) window.currentGroup.settled = [];
    const settlement = { member, amount };
    window.currentGroup.settled.push(settlement);
    await window.saveSettlement(window.currentGroup.id, settlement);
    renderChart();
    renderExpenseLog();
};

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
        const colors = ['#2d8cff','#5b8f67','#d46b82','#f7c948','#a855f7','#f97316'];
        if (window._pieChart) window._pieChart.destroy();
        if (labels.length === 0) {
            document.getElementById('chartMembers').innerHTML = '<p style="color:#aaa; font-size:13px; text-align:center;">No expenses yet</p>';
            return;
        }
        const ctx = document.getElementById('pieChart').getContext('2d');
        window._pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: { labels, datasets: [{ data: values, backgroundColor: colors.slice(0, labels.length), borderWidth: 2, borderColor: '#fff' }] },
            options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 } } } } }
        });
        const chart = document.getElementById('chartMembers');
        chart.innerHTML = '';
        const members = window.currentGroup.members;
        const owedMap = {};
        members.forEach(m => owedMap[m.trim()] = 0);
        (window.currentGroup.expenses || []).forEach(exp => {
            members.forEach(m => {
                if (m !== exp.payer) { const amt = exp.splits ? exp.splits[m] : (exp.amount / members.length); owedMap[m.trim()] += amt || 0; }
            });
        });
        (window.currentGroup.settled || []).forEach(s => { owedMap[s.member] = Math.max(0, (owedMap[s.member] || 0) - s.amount); });
        members.forEach(member => {
            const owed = owedMap[member.trim()];
            chart.innerHTML += `<div style="text-align:center; font-size:12px;">
                <div style="font-weight:bold; color:#333;">${member.trim()}</div>
                <div style="color:${owed > 0 ? '#d46b82' : '#5b8f67'};">${owed > 0 ? currentCurrency + owed.toFixed(0) : '✓'}</div>
            </div>`;
        });
    } catch(err) { console.error('Chart error:', err); }
};

window.renderExpenseLog = function () {
    if (!window.currentGroup) return;
    const resultBox = document.getElementById('resultContainer');
    resultBox.innerHTML = '';
    const totalSpend = (window.currentGroup.expenses || []).reduce((s,e) => s + e.amount, 0);
    const myShare = totalSpend / window.currentGroup.members.length;
    resultBox.innerHTML += `
        <div style="background:linear-gradient(135deg,#2d8cff,#5b8f67); color:white; padding:14px; border-radius:14px; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between;">
                <div><div style="font-size:11px; opacity:0.8;">Total Spent</div>
                <div style="font-size:20px; font-weight:bold;">${currentCurrency}${totalSpend.toFixed(2)}</div></div>
                <div style="text-align:right;"><div style="font-size:11px; opacity:0.8;">Per Person</div>
                <div style="font-size:20px; font-weight:bold;">${currentCurrency}${myShare.toFixed(2)}</div></div>
            </div>
        </div>`;
    const t = translations[currentLang];
    if ((window.currentGroup.expenses || []).length === 0) {
        resultBox.innerHTML += `<div style="text-align:center; color:#aaa; padding:20px;">
            <div style="font-size:30px;">🧾</div><p><b>${t.noExpenses}</b></p>
            <p style="font-size:12px;">${t.tapToAdd}</p></div>`;
        return;
    }
    resultBox.innerHTML += `<p style="font-weight:bold; color:#555; font-size:13px; margin:10px 0 8px;">${t.expenseHistory}</p>`;
    [...window.currentGroup.expenses].reverse().forEach(exp => {
        const splits = window.currentGroup.members.map(m => {
            const amt = exp.splits ? exp.splits[m] : (exp.amount / window.currentGroup.members.length);
            if (m === exp.payer) return `<span style="font-size:10px; background:#e6f4ea; color:#5b8f67; padding:2px 6px; border-radius:20px;">${m} ${t.paid}</span>`;
            return `<span style="font-size:10px; background:#fde8ee; color:#d46b82; padding:2px 6px; border-radius:20px;">${m} ${t.owes} ${currentCurrency}${amt ? amt.toFixed(2) : '0.00'}</span>`;
        }).join(' ');
        const splitLabel = exp.splitType && exp.splitType !== 'Equal'
            ? `<span style="font-size:10px; background:#eef; color:#2d8cff; padding:2px 6px; border-radius:20px; margin-left:4px;">${exp.splitType}</span>` : '';
        const expIndex = window.currentGroup.expenses.indexOf(exp);
        resultBox.innerHTML += `
            <div class="expense-item-card" style="background:white; padding:12px; border-radius:12px; margin-bottom:8px; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold; color:#333; align-items:center;">
                    <span>${exp.category || ''} ${exp.name} ${splitLabel}</span>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <span style="font-size:10px; color:#aaa; font-weight:normal;">${exp.date || ''}</span>
                        <span>${currentCurrency}${exp.amount}</span>
                        <button onclick="window.editExpensePrompt(${expIndex})" style="background:none; border:none; color:#2d8cff; font-size:14px; cursor:pointer; padding:0;">✏️</button>
                        <button onclick="confirmDeleteExpense(${expIndex})" style="background:none; border:none; color:#d46b82; font-size:14px; cursor:pointer; padding:0;">🗑️</button>
                    </div>
                </div>
                <div style="margin-top:5px;">${splits}</div>
            </div>`;
    });
    resultBox.innerHTML += `<p style="font-weight:bold; color:#555; font-size:13px; margin:15px 0 8px;">${t.settleUp}</p>`;
    const owedMap = {};
    window.currentGroup.members.forEach(m => owedMap[m] = 0);
    (window.currentGroup.expenses || []).forEach(exp => {
        window.currentGroup.members.forEach(m => {
            if (m !== exp.payer) { const amt = exp.splits ? exp.splits[m] : (exp.amount / window.currentGroup.members.length); owedMap[m] += amt || 0; }
        });
    });
    (window.currentGroup.settled || []).forEach(s => { owedMap[s.member] = Math.max(0, owedMap[s.member] - s.amount); });
    let anyUnsettled = false;
    window.currentGroup.members.forEach(member => {
        const owed = owedMap[member];
        if (owed > 0.01) {
            anyUnsettled = true;
            resultBox.innerHTML += `
                <div style="background:white; padding:12px; border-radius:12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 6px rgba(0,0,0,0.05);">
                    <div><span style="font-size:13px; color:#333;">${member.trim()}</span><br>
                    <span style="color:#d46b82; font-size:12px;">${t.owes} ${currentCurrency}${owed.toFixed(2)}</span></div>
                    <button onclick="settleUp('${member}', ${owed})"
                        style="background:#5b8f67; color:white; border:none; padding:8px 12px; border-radius:10px; font-size:12px; cursor:pointer;">${t.settle}</button>
                </div>`;
        }
    });
    if (!anyUnsettled) {
        resultBox.innerHTML += `<div style="text-align:center; color:#5b8f67; padding:15px; background:white; border-radius:12px;">🎉 <b>${t.allSettled}</b></div>`;
        launchConfetti();
    }
};

window.setTheme = function (mode) {
    const phone = document.querySelector('.phone');
    const sidebar = document.querySelector('.sidebar');
    if (mode === 'dark') { phone.style.background = '#1a1a1a'; phone.style.color = 'white'; sidebar.style.background = '#2d2d2d'; sidebar.style.color = 'white'; }
    else { phone.style.background = ''; phone.style.color = ''; sidebar.style.background = ''; sidebar.style.color = ''; }
    renderDashboard();
    toggleMenu();
};

const translations = {
    english: {
        hello: "Hello, User 👋", welcome: "Welcome to Equapay", getStarted: "Get Started",
        tagline: "Manage shared expenses without the stress.",
        emailPlaceholder: "Email or Phone Number", passwordPlaceholder: "Password",
        yourGroups: "Your Groups", searchGroups: "Search groups...",
        newGroup: "New Group", settings: "Settings", groups: "Groups",
        darkMode: "Dark mode", lightMode: "Light mode", language: "Language",
        notifications: "Notifications", logout: "Logout",
        addExpense: "Add Expense", itemName: "e.g. Electricity", whoPaid: "Who Paid?",
        amount: "Amount", confirmSplit: "Confirm Split",
        expenseHistory: "Expense History", settleUp: "Settle Up",
        noExpenses: "No expenses yet", tapToAdd: "Tap + to add one",
        allSettled: "All settled up!", settle: "Settle ✓", paid: "paid", owes: "owes",
        members: "members", expenses: "expenses",
        groupName: "e.g., Weekend Trip", groupMembers: "Add names (e.g. Sidra, Sania)",
        description: "What is this group for?", createGroup: "Create Group",
        noGroups: "No groups yet", tapToCreate: "Tap + to create your first group",
        groupNameLabel: "Group Name:", groupMembersLabel: "Group Members:",
        groupDescLabel: "Description (optional):", itemNameLabel: "Item Name:"
    },
    hindi: {
        hello: "नमस्ते, उपयोगकर्ता 👋", welcome: "Equapay में आपका स्वागत है", getStarted: "शुरू करें",
        tagline: "बिना तनाव के साझा खर्च प्रबंधित करें।",
        emailPlaceholder: "ईमेल या फोन नंबर", passwordPlaceholder: "पासवर्ड",
        yourGroups: "आपके समूह", searchGroups: "समूह खोजें...",
        newGroup: "नया समूह", settings: "सेटिंग्स", groups: "समूह",
        darkMode: "डार्क मोड", lightMode: "लाइट मोड", language: "भाषा",
        notifications: "सूचनाएं", logout: "लॉगआउट",
        addExpense: "खर्च जोड़ें", itemName: "जैसे बिजली", whoPaid: "किसने भुगतान किया?",
        amount: "राशि", confirmSplit: "विभाजन की पुष्टि करें",
        expenseHistory: "खर्च इतिहास", settleUp: "भुगतान करें",
        noExpenses: "अभी तक कोई खर्च नहीं", tapToAdd: "+ दबाएं जोड़ने के लिए",
        allSettled: "सब भुगतान हो गया!", settle: "भुगतान ✓", paid: "ने भुगतान किया", owes: "बकाया",
        members: "सदस्य", expenses: "खर्च",
        groupName: "जैसे, वीकेंड ट्रिप", groupMembers: "नाम जोड़ें",
        description: "यह समूह किसके लिए है?", createGroup: "समूह बनाएं",
        noGroups: "अभी कोई समूह नहीं", tapToCreate: "+ दबाएं पहला समूह बनाने के लिए",
        groupNameLabel: "समूह का नाम:", groupMembersLabel: "सदस्य:",
        groupDescLabel: "विवरण (वैकल्पिक):", itemNameLabel: "वस्तु का नाम:"
    },
    telugu: {
        hello: "హలో, వినియోగదారు 👋", welcome: "Equapay కి స్వాగతం", getStarted: "ప్రారంభించండి",
        tagline: "ఒత్తిడి లేకుండా భాగస్వామ్య ఖర్చులు నిర్వహించండి.",
        emailPlaceholder: "ఇమెయిల్ లేదా ఫోన్ నంబర్", passwordPlaceholder: "పాస్వర్డ్",
        yourGroups: "మీ గ్రూప్లు", searchGroups: "గ్రూప్లు వెతకండి...",
        newGroup: "కొత్త గ్రూప్", settings: "సెట్టింగులు", groups: "గ్రూప్లు",
        darkMode: "డార్క్ మోడ్", lightMode: "లైట్ మోడ్", language: "భాష",
        notifications: "నోటిఫికేషన్లు", logout: "లాగ్అవుట్",
        addExpense: "ఖర్చు జోడించండి", itemName: "ఉదా. విద్యుత్", whoPaid: "ఎవరు చెల్లించారు?",
        amount: "మొత్తం", confirmSplit: "విభజనను నిర్ధారించండి",
        expenseHistory: "ఖర్చుల చరిత్ర", settleUp: "సెటిల్ చేయండి",
        noExpenses: "ఇంకా ఖర్చులు లేవు", tapToAdd: "+ నొక్కి జోడించండి",
        allSettled: "అన్నీ చెల్లిపోయాయి!", settle: "సెటిల్ ✓", paid: "చెల్లించారు", owes: "బాకీ",
        members: "సభ్యులు", expenses: "ఖర్చులు",
        groupName: "ఉదా., వీకెండ్ ట్రిప్", groupMembers: "పేర్లు జోడించండి",
        description: "ఈ గ్రూప్ దేని కోసం?", createGroup: "గుంపును సృష్టించండి",
        noGroups: "ఇంకా గుంపులు లేవు", tapToCreate: "+ నొక్కి మీ మొదటి గుంపును సృష్టించండి",
        groupNameLabel: "గ్రూప్ పేరు:", groupMembersLabel: "గ్రూప్ సభ్యులు:",
        groupDescLabel: "వివరణ (ఐచ్ఛికం):", itemNameLabel: "వస్తువు పేరు:"
    },
    urdu: {
        hello: "ہیلو، صارف 👋", welcome: "Equapay میں خوش آمدید", getStarted: "شروع کریں",
        tagline: "بغیر تناؤ کے مشترکہ اخراجات کا انتظام کریں۔",
        emailPlaceholder: "ای میل یا فون نمبر", passwordPlaceholder: "پاس ورڈ",
        yourGroups: "آپ کے گروپ", searchGroups: "گروپ تلاش کریں...",
        newGroup: "نیا گروپ", settings: "ترتیبات", groups: "گروپ",
        darkMode: "ڈارک موڈ", lightMode: "لائٹ موڈ", language: "زبان",
        notifications: "اطلاعات", logout: "لاگ آؤٹ",
        addExpense: "خرچ شامل کریں", itemName: "مثلاً بجلی", whoPaid: "کس نے ادا کیا؟",
        amount: "رقم", confirmSplit: "تقسیم کی تصدیق کریں",
        expenseHistory: "خرچ کی تاریخ", settleUp: "ادائیگی کریں",
        noExpenses: "ابھی کوئی خرچ نہیں", tapToAdd: "+ دبائیں شامل کرنے کے لیے",
        allSettled: "سب ادا ہو گیا!", settle: "ادا کریں ✓", paid: "نے ادا کیا", owes: "مقروض",
        members: "اراکین", expenses: "اخراجات",
        groupName: "مثلاً، ویک اینڈ ٹرپ", groupMembers: "نام شامل کریں",
        description: "یہ گروپ کس لیے ہے?", createGroup: "گروپ بنائیں",
        noGroups: "ابھی کوئی گروپ نہیں", tapToCreate: "+ دبائیں پہلا گروپ بنانے کے لیے",
        groupNameLabel: "گروپ کا نام:", groupMembersLabel: "اراکین:",
        groupDescLabel: "تفصیل (اختیاری):", itemNameLabel: "چیز کا نام:"
    }
};

window.applyLanguage = function (lang) {
    currentLang = lang;
    const t = translations[lang];
    document.querySelector('.welcome-text h1').textContent = t.hello;
    document.querySelector('.welcome-text p').textContent = t.welcome;
    document.querySelector('.start-btn').textContent = t.getStarted;
    document.querySelector('.tagline').textContent = t.tagline;
    document.querySelector('#login input[type=text]').placeholder = t.emailPlaceholder;
    document.querySelector('#login input[type=password]').placeholder = t.passwordPlaceholder;
    document.querySelector('.section-title').textContent = t.yourGroups;
    document.querySelector('.search-bar').placeholder = t.searchGroups;
    document.querySelector('#addGroup h3').textContent = t.newGroup;
    document.querySelector('#groupInput').placeholder = t.groupName;
    document.querySelector('#groupMembers').placeholder = t.groupMembers;
    document.querySelector('#groupDesc').placeholder = t.description;
    document.querySelector('#addGroup .primary-btn').textContent = t.createGroup;
    document.querySelector('#addExpense h3').textContent = t.addExpense;
    document.querySelector('#expName').placeholder = t.itemName;
    document.querySelector('.amount-section p').textContent = t.amount;
    document.querySelector('#addExpense .primary-btn').textContent = t.confirmSplit;
    if (document.getElementById('whoPaidLabel')) document.getElementById('whoPaidLabel').textContent = t.whoPaid;
    if (document.getElementById('itemNameLabel')) document.getElementById('itemNameLabel').textContent = t.itemNameLabel;
    if (document.getElementById('groupNameLabel')) document.getElementById('groupNameLabel').textContent = t.groupNameLabel;
    if (document.getElementById('groupMembersLabel')) document.getElementById('groupMembersLabel').textContent = t.groupMembersLabel;
    if (document.getElementById('groupDescLabel')) document.getElementById('groupDescLabel').textContent = t.groupDescLabel;
    document.getElementById('sidebarSettings').textContent = t.settings;
    document.getElementById('sidebarGroups').textContent = t.groups;
    document.getElementById('sidebarDark').textContent = t.darkMode;
    document.getElementById('sidebarLight').textContent = t.lightMode;
    document.getElementById('sidebarLanguage').textContent = t.language;
    document.getElementById('sidebarNotif').innerHTML = t.notifications + ' <span class="float-right">ON</span>';
    document.getElementById('sidebarLogout').textContent = t.logout;
    document.querySelector('#noGroupsMsg p b').textContent = t.noGroups;
    document.querySelector('#noGroupsMsg .hint').textContent = t.tapToCreate;
    const splitLabels = {
        english: ['⚖️ Equal', '📊 Percent', '✏️ Exact', '🔢 Shares'],
        hindi: ['⚖️ बराबर', '📊 प्रतिशत', '✏️ सटीक', '🔢 हिस्से'],
        telugu: ['⚖️ సమాన', '📊 శాతం', '✏️ ఖచ్చితం', '🔢 వాటాలు'],
        urdu: ['⚖️ برابر', '📊 فیصد', '✏️ عین', '🔢 حصے']
    };
    const labels = splitLabels[lang] || splitLabels['english'];
    ['Equal', 'Percentage', 'Exact', 'Share'].forEach((type, i) => {
        const btn = document.getElementById('splitBtn' + type);
        if (btn) btn.textContent = labels[i];
    });
    if (document.getElementById('splitTypeLabel')) {
        const splitTypeNames = { english: 'Split Type', hindi: 'विभाजन प्रकार', telugu: 'విభజన రకం', urdu: 'تقسیم کی قسم' };
        document.getElementById('splitTypeLabel').textContent = splitTypeNames[lang] || 'Split Type';
    }
    const currencyLabels = { english: 'Currency', hindi: 'मुद्रा', telugu: 'కరెన్సీ', urdu: 'کرنسی' };
    const splitLabels2 = { english: 'Split type', hindi: 'विभाजन', telugu: 'విభజన', urdu: 'تقسیم' };
    document.querySelector('#currencySelect').previousElementSibling.textContent = currencyLabels[lang] || 'Currency';
    document.querySelector('#splitSelect').previousElementSibling.textContent = splitLabels2[lang] || 'Split type';
    const splitOptions = {
        english: ['Equal', 'Percentage', 'Exact Amount', 'By Shares'],
        hindi: ['बराबर', 'प्रतिशत', 'सटीक राशि', 'हिस्सों से'],
        telugu: ['సమాన', 'శాతం', 'ఖచ్చిత మొత్తం', 'వాటాల ద్వారా'],
        urdu: ['برابر', 'فیصد', 'عین رقم', 'حصوں سے']
    };
    const opts = splitOptions[lang] || splitOptions['english'];
    ['Equal', 'Percentage', 'Exact', 'Share'].forEach((id, i) => { const el = document.getElementById('opt' + id); if (el) el.textContent = opts[i]; });
    showLanguagePicker(false);
    renderDashboard();
    if (window.currentGroup) { renderChart(); renderExpenseLog(); }
};

window.toggleNotifications = function () {
    const span = document.querySelector('#sidebarNotif span');
    notificationsEnabled = !notificationsEnabled;
    span.textContent = notificationsEnabled ? 'ON' : 'OFF';
    if (notificationsEnabled) {
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

window.notifyOwed = function () {
    if (!notificationsEnabled) { alert('Turn on notifications in settings first!'); return; }
    if (!window.currentGroup) { alert('Open a group first!'); return; }
    const owedMap = {};
    window.currentGroup.members.forEach(m => owedMap[m] = 0);
    (window.currentGroup.expenses || []).forEach(exp => {
        window.currentGroup.members.forEach(m => {
            if (m !== exp.payer) { const amt = exp.splits ? exp.splits[m] : (exp.amount / window.currentGroup.members.length); owedMap[m] += amt || 0; }
        });
    });
    (window.currentGroup.settled || []).forEach(s => { owedMap[s.member] = Math.max(0, owedMap[s.member] - s.amount); });
    const debtors = Object.entries(owedMap).filter(([m, amt]) => amt > 0.01);
    if (debtors.length === 0) { alert('Everyone is settled up! 🎉'); return; }
    if (Notification.permission === 'granted') {
        debtors.forEach(([member, amt]) => {
            new Notification(`💸 ${member} owes money!`, {
                body: `${member} owes ${currentCurrency}${amt.toFixed(2)} in ${window.currentGroup.name}`,
                icon: 'logo.png'
            });
        });
    } else {
        Notification.requestPermission().then(perm => {
            if (perm === 'granted') notifyOwed();
            else alert(debtors.map(([m, a]) => `${m} owes ${currentCurrency}${a.toFixed(2)}`).join('\n'));
        });
    }
};

window.showLanguagePicker = function (show) { document.getElementById('languagePicker').style.display = show ? 'block' : 'none'; };
window.changeCurrency = function (symbol) { currentCurrency = symbol; renderDashboard(); if (window.currentGroup) { renderChart(); renderExpenseLog(); } };
window.changeSplit = function (type) { currentSplitType = type; };

window.confirmDeleteExpense = function(index) {
    if (confirm('Delete this expense?')) window.deleteExpense(window.currentGroup.id, index);
};
window.editExpensePrompt = function(index) {
    const exp = window.currentGroup.expenses[index];
    const newName = prompt('Expense name:', exp.name);
    if (!newName) return;
    const newAmt = parseFloat(prompt('Amount:', exp.amount));
    if (!newAmt) return;
    const updated = { ...exp, name: newName, amount: newAmt };
    window.editExpense(window.currentGroup.id, index, updated);
};
window.shareExpenseSummary = function () {
    if (!window.currentGroup) return;
    const lines = [`📋 ${window.currentGroup.name} — Expense Summary\n`];
    (window.currentGroup.expenses || []).forEach(exp => { lines.push(`• ${exp.name}: ${currentCurrency}${exp.amount} (paid by ${exp.payer})`); });
    const total = (window.currentGroup.expenses || []).reduce((s, e) => s + e.amount, 0);
    lines.push(`\nTotal: ${currentCurrency}${total.toFixed(2)}`);
    const text = lines.join('\n');
    if (navigator.share) navigator.share({ title: window.currentGroup.name, text });
    else navigator.clipboard.writeText(text).then(() => alert('Summary copied to clipboard!'));
};
window.confirmDeleteGroup = function () {
    if (confirm('Delete this entire group? This cannot be undone.')) window.deleteGroup(window.currentGroup.id);
};
window.showEditMembers = function () {
    const panel = document.getElementById('editMembersPanel');
    document.getElementById('editMembersInput').value = window.currentGroup.members.join(', ');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
};
window.saveEditedMembers = function () {
    const input = document.getElementById('editMembersInput').value.trim();
    if (!input) { alert('Please enter at least one member'); return; }
    const newMembers = input.split(',').map(m => m.trim()).filter(Boolean);
    window.updateGroupMembers(window.currentGroup.id, newMembers);
    document.getElementById('editMembersPanel').style.display = 'none';
};
window.selectCategory = function(btn, value) {
    document.querySelectorAll('.cat-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('categorySelect').value = value;
};
window.showLoading = function() { const s = document.getElementById('loadingSpinner'); if(s) s.style.display = 'block'; };
window.hideLoading = function() { const s = document.getElementById('loadingSpinner'); if(s) s.style.display = 'none'; };
window.launchConfetti = function() {
    const colors = ['#2d8cff','#5b8f67','#d46b82','#f7c948','#a855f7'];
    for (let i = 0; i < 60; i++) {
        const dot = document.createElement('div');
        dot.style.cssText = `position:fixed; width:8px; height:8px; border-radius:50%;
            background:${colors[Math.floor(Math.random()*colors.length)]};
            left:${Math.random()*100}vw; top:-10px;
            animation: fall ${1.5 + Math.random()}s linear forwards; z-index:9999;`;
        document.body.appendChild(dot);
        setTimeout(() => dot.remove(), 2500);
    }
};
window.filterExpenses = function(query) {
    const cards = document.querySelectorAll('.expense-item-card');
    cards.forEach(card => { card.style.display = card.textContent.toLowerCase().includes(query.toLowerCase()) ? 'block' : 'none'; });
};