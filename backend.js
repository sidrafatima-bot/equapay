// ============================================================
//  BACKEND.JS - FIREBASE AUTH + FIRESTORE DATABASE
// ============================================================

// ============================================================
//  SECTION 1: IMPORTS
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup,
    getRedirectResult,
    signOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
    getFirestore,
    collection,
    addDoc,
    getDocs,
    deleteDoc,
    doc,
    getDoc,
    query,
    where,
    onSnapshot,
    updateDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ============================================================
//  SECTION 2: FIREBASE CONFIG
// ============================================================
const firebaseConfig = {
    apiKey: "AIzaSyBYJel4b02QXpbQU7tWc2dd1ns36hknUbY",
    authDomain: "equapay-52729.firebaseapp.com",
    projectId: "equapay-52729",
    storageBucket: "equapay-52729.firebasestorage.app",
    messagingSenderId: "100025932427",
    appId: "1:100025932427:web:53cae98e55b45ca4ae528e"
};

// ============================================================
//  SECTION 3: INITIALIZE FIREBASE + FIRESTORE
// ============================================================
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

getRedirectResult(auth).then((result) => {
    if (result && result.user) {
        const name = result.user.displayName || 'User';
        document.getElementById('sidebarName').textContent = name;
        loadGroups(result.user.uid);
        window.showPage('dashboard');
    }
}).catch(err => console.error(err));

let activeGroupListener = null;
let autoReminderInterval = null;

// ============================================================
//  SECTION 4: AUTH STATE LISTENER
// ============================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        const name = user.displayName || user.email.split('@')[0];
        document.getElementById('sidebarName').textContent = name;

        // Show email verification banner if not verified — NEW
        if (!user.emailVerified) {
            showVerificationBanner(user);
        } else {
            hideVerificationBanner();
        }

        loadGroups(user.uid);
        window.showPage('dashboard');
        startAutoReminders();
    } else {
        stopAutoReminders();
        window.showPage('welcome');
    }
});

// ============================================================
//  SECTION 4a: EMAIL VERIFICATION BANNER — NEW
// ============================================================
function showVerificationBanner(user) {
    let banner = document.getElementById('verifyBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'verifyBanner';
        banner.style.cssText = `
            position: fixed; top: 0; left: 0; right: 0; z-index: 9998;
            background: #fff8e6; border-bottom: 1px solid #f7c948;
            padding: 10px 16px; font-size: 13px; color: #7a5c00;
            display: flex; align-items: center; justify-content: space-between; gap: 8px;
        `;
        banner.innerHTML = `
            <span>📧 Please verify your email to secure your account.</span>
            <div style="display:flex; gap:8px;">
                <button id="resendVerifyBtn" onclick="window.resendVerificationEmail()"
                    style="background:#f7c948; border:none; border-radius:8px; padding:5px 10px; font-size:12px; cursor:pointer; color:#5a3e00; font-weight:bold;">
                    Resend Email
                </button>
                <button onclick="document.getElementById('verifyBanner').style.display='none'"
                    style="background:none; border:none; font-size:16px; cursor:pointer; color:#aaa;">✕</button>
            </div>`;
        document.body.prepend(banner);
    }
    banner.style.display = 'flex';
}

function hideVerificationBanner() {
    const banner = document.getElementById('verifyBanner');
    if (banner) banner.style.display = 'none';
}

window.resendVerificationEmail = async function () {
    const user = auth.currentUser;
    if (!user) return;
    const btn = document.getElementById('resendVerifyBtn');
    if (btn) { btn.textContent = 'Sending...'; btn.disabled = true; }
    try {
        await sendEmailVerification(user);
        if (btn) { btn.textContent = 'Sent! ✓'; btn.style.background = '#d4edda'; }
        setTimeout(() => {
            if (btn) { btn.textContent = 'Resend Email'; btn.disabled = false; btn.style.background = '#f7c948'; }
        }, 5000);
    } catch (err) {
        if (btn) { btn.textContent = 'Try again later'; btn.disabled = false; }
        console.error('Error sending verification:', err);
    }
};

// ============================================================
//  SECTION 5: SIGN IN
// ============================================================
window.firebaseSignIn = function () {
    const email = document.getElementById('signInEmail').value.trim();
    const pass = document.getElementById('signInPass').value.trim();
    const errEl = document.getElementById('signInError');
    errEl.style.display = 'none';
    if (!email || !pass) { showSignInError('Please enter email and password'); return; }
    signInWithEmailAndPassword(auth, email, pass)
        .then((result) => {
            const name = result.user.displayName || email.split('@')[0];
            document.getElementById('sidebarName').textContent = name;
            loadGroups(result.user.uid);
            window.showPage('dashboard');
        })
        .catch((err) => {
            const msg = err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found'
                ? 'Wrong email or password'
                : err.code === 'auth/too-many-requests'
                ? 'Too many attempts. Please try again later.'
                : 'Sign in failed. Please try again.';
            showSignInError(msg);
        });
};

function showSignInError(msg) {
    const el = document.getElementById('signInError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

// ============================================================
//  SECTION 6: SIGN UP with email verification — UPDATED
// ============================================================
window.firebaseSignUp = function () {
    const fullName = document.getElementById('signUpName').value.trim();
    const username = document.getElementById('signUpUsername').value.trim().replace(/^@/, '').toLowerCase();
    const email = document.getElementById('signUpEmail').value.trim();
    const pass = document.getElementById('signUpPass').value.trim();
    const errEl = document.getElementById('signUpError');
    if (errEl) errEl.style.display = 'none';

    if (!fullName) { showSignUpError('Please enter your full name'); return; }
    if (!username || username.length < 3) { showSignUpError('Username must be at least 3 characters'); return; }
    if (!/^[a-z0-9_]+$/.test(username)) { showSignUpError('Username can only contain letters, numbers, and underscores'); return; }
    if (!email) { showSignUpError('Please enter your email'); return; }
    if (!pass || pass.length < 6) { showSignUpError('Password must be at least 6 characters'); return; }

    checkUsernameAvailable(username).then(available => {
        if (!available) { showSignUpError(`Username @${username} is already taken`); return; }
        createUserWithEmailAndPassword(auth, email, pass)
            .then(async (result) => {
                await updateProfile(result.user, { displayName: fullName });
                await setDoc(doc(db, 'users', result.user.uid), {
                    uid: result.user.uid,
                    name: fullName,
                    username: username,
                    email: email,
                    createdAt: new Date()
                });

                // Send email verification — NEW
                try {
                    await sendEmailVerification(result.user);
                } catch (verifyErr) {
                    console.warn('Could not send verification email:', verifyErr);
                }

                document.getElementById('sidebarName').textContent = fullName;
                window.showPage('dashboard');

                // Show verification notice — NEW
                showVerificationBanner(result.user);
            })
            .catch(err => {
                const msg = err.code === 'auth/email-already-in-use'
                    ? 'This email is already registered'
                    : err.message;
                showSignUpError(msg);
            });
    });
};

function showSignUpError(msg) {
    const el = document.getElementById('signUpError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
}

// Password strength indicator
document.addEventListener('DOMContentLoaded', () => {
    const passInput = document.getElementById('signUpPass');
    if (passInput) {
        passInput.addEventListener('input', () => {
            const val = passInput.value;
            const bar = document.getElementById('passStrengthBar');
            const msg = document.getElementById('passStrengthMsg');
            if (!bar || !msg) return;
            if (val.length === 0) { bar.style.background = '#eee'; msg.textContent = ''; return; }
            let score = 0;
            if (val.length >= 8) score++;
            if (/[A-Z]/.test(val)) score++;
            if (/[0-9]/.test(val)) score++;
            if (/[^A-Za-z0-9]/.test(val)) score++;
            const levels = [
                { color: '#d46b82', text: 'Weak' },
                { color: '#f7c948', text: 'Fair' },
                { color: '#5b8f67', text: 'Good' },
                { color: '#2d8cff', text: 'Strong' }
            ];
            const l = levels[Math.min(score, 3)];
            bar.style.background = l.color;
            msg.style.color = l.color;
            msg.textContent = l.text;
        });
    }
});

// ============================================================
//  SECTION 6a: CHECK USERNAME AVAILABILITY
// ============================================================
async function checkUsernameAvailable(username) {
    try {
        const q = query(collection(db, 'users'), where('username', '==', username));
        const snap = await getDocs(q);
        return snap.empty;
    } catch (err) {
        console.error('Error checking username:', err);
        return true;
    }
}

// ============================================================
//  SECTION 6b: LOOKUP USER BY USERNAME
// ============================================================
window.lookupUserByUsername = async function (username) {
    try {
        const clean = username.replace(/^@/, '').toLowerCase();
        const q = query(collection(db, 'users'), where('username', '==', clean));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return snap.docs[0].data();
    } catch (err) {
        console.error('Error looking up username:', err);
        return null;
    }
};

// ============================================================
//  SECTION 6c: FORGOT PASSWORD
// ============================================================
window.showForgotPassword = function () {
    const panel = document.getElementById('forgotPanel');
    if (panel) {
        panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
        document.getElementById('resetMsg').textContent = '';
    }
};

window.sendPasswordReset = function () {
    const email = document.getElementById('resetEmail').value.trim();
    const msg = document.getElementById('resetMsg');
    if (!email) { msg.style.color = '#d46b82'; msg.textContent = 'Please enter your email'; return; }
    msg.style.color = '#aaa'; msg.textContent = 'Sending...';
    sendPasswordResetEmail(auth, email)
        .then(() => {
            msg.style.color = '#5b8f67';
            msg.textContent = '✓ Reset email sent! Check your inbox.';
        })
        .catch(err => {
            msg.style.color = '#d46b82';
            msg.textContent = err.code === 'auth/user-not-found'
                ? 'No account found with this email'
                : 'Failed to send reset email';
        });
};

// ============================================================
//  SECTION 7: GOOGLE SIGN IN
// ============================================================
window.googleSignIn = function () {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider)
        .then((result) => {
            const name = result.user.displayName || 'User';
            document.getElementById('sidebarName').textContent = name;
            loadGroups(result.user.uid);
            window.showPage('dashboard');
        })
        .catch(err => console.error(err));
};

// ============================================================
//  SECTION 8: LOGOUT
// ============================================================
window.doLogout = function () {
    if (activeGroupListener) { activeGroupListener(); activeGroupListener = null; }
    stopAutoReminders();
    signOut(auth).then(() => {
        window.groups = [];
        window.currentGroup = null;
        window.notificationLog = [];
        hideVerificationBanner();
        window.showPage('welcome');
    }).catch(err => console.error('Logout error:', err));
};

// ============================================================
//  SECTION 9: UPDATE USER PROFILE
// ============================================================
window.updateUserName = async function (newName) {
    const user = auth.currentUser;
    if (!user || !newName) return;
    try {
        await updateProfile(user, { displayName: newName });
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { name: newName });
        document.getElementById('sidebarName').textContent = newName;
        alert('Name updated!');
    } catch (err) {
        console.error('Error updating name:', err);
    }
};

// ============================================================
//  SECTION 10: SAVE GROUP
// ============================================================
window.saveGroup = async function (group) {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const docRef = await addDoc(collection(db, 'groups'), {
            userId: user.uid,
            name: group.name,
            members: group.members,
            expenses: [],
            settled: [],
            createdAt: new Date()
        });
        return docRef.id;
    } catch (err) {
        console.error('Error saving group:', err);
    }
};

// ============================================================
//  SECTION 11: LOAD GROUPS
// ============================================================
window.loadGroups = async function (uid) {
    try {
        const q = query(collection(db, 'groups'), where('userId', '==', uid));
        const snapshot = await getDocs(q);
        window.groups = [];
        snapshot.forEach(d => { window.groups.push({ id: d.id, ...d.data() }); });
        renderDashboard();
    } catch (err) {
        console.error('Error loading groups:', err);
    }
};

// ============================================================
//  SECTION 12: REAL-TIME GROUP LISTENER
// ============================================================
window.listenToGroup = function (groupId) {
    if (activeGroupListener) { activeGroupListener(); activeGroupListener = null; }
    const groupRef = doc(db, 'groups', groupId);
    activeGroupListener = onSnapshot(groupRef, (snap) => {
        if (!snap.exists()) return;
        const data = snap.data();
        window.currentGroup.expenses = data.expenses || [];
        window.currentGroup.settled = data.settled || [];
        const idx = window.groups.findIndex(g => g.id === groupId);
        if (idx !== -1) window.groups[idx] = { ...window.groups[idx], ...data };
        renderChart();
        renderExpenseLog();
        renderDashboard();
        updateNotifBadge();
    });
};

// ============================================================
//  SECTION 13: SAVE EXPENSE
// ============================================================
window.saveExpense = async function (groupId, expense) {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        const existing = groupSnap.data().expenses || [];
        existing.push(expense);
        await updateDoc(groupRef, { expenses: existing });
    } catch (err) {
        console.error('Error saving expense:', err);
    }
};

// ============================================================
//  SECTION 14: LOAD EXPENSES
// ============================================================
window.loadExpenses = async function (groupId) {
    try {
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        return groupSnap.data().expenses || [];
    } catch (err) {
        console.error('Error loading expenses:', err);
        return [];
    }
};

// ============================================================
//  SECTION 15: DELETE EXPENSE
// ============================================================
window.deleteExpense = async function (groupId, expenseIndex) {
    try {
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        const expenses = groupSnap.data().expenses || [];
        expenses.splice(expenseIndex, 1);
        await updateDoc(groupRef, { expenses });
        window.currentGroup.expenses = expenses;
        renderChart();
        renderExpenseLog();
        renderDashboard();
    } catch (err) {
        console.error('Error deleting expense:', err);
    }
};

// ============================================================
//  SECTION 16: EDIT EXPENSE
// ============================================================
window.editExpense = async function (groupId, expenseIndex, updatedExpense) {
    try {
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        const expenses = groupSnap.data().expenses || [];
        expenses[expenseIndex] = updatedExpense;
        await updateDoc(groupRef, { expenses });
        window.currentGroup.expenses = expenses;
        renderChart();
        renderExpenseLog();
    } catch (err) {
        console.error('Error editing expense:', err);
    }
};

// ============================================================
//  SECTION 17: SAVE SETTLEMENT
// ============================================================
window.saveSettlement = async function (groupId, settlement) {
    const user = auth.currentUser;
    if (!user) return;
    try {
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        const existing = groupSnap.data().settled || [];
        existing.push(settlement);
        await updateDoc(groupRef, { settled: existing });
    } catch (err) {
        console.error('Error saving settlement:', err);
    }
};

// ============================================================
//  SECTION 17a: SAVE ALL SETTLEMENTS (for undo) — NEW
// ============================================================
window.saveAllSettlements = async function (groupId, settlements) {
    try {
        const groupRef = doc(db, 'groups', groupId);
        await updateDoc(groupRef, { settled: settlements });
    } catch (err) {
        console.error('Error saving settlements:', err);
    }
};

// ============================================================
//  SECTION 18: LOAD SETTLEMENTS
// ============================================================
window.loadSettlements = async function (groupId) {
    try {
        const groupRef = doc(db, 'groups', groupId);
        const groupSnap = await getDoc(groupRef);
        return groupSnap.data().settled || [];
    } catch (err) {
        console.error('Error loading settlements:', err);
        return [];
    }
};

// ============================================================
//  SECTION 19: UPDATE GROUP MEMBERS
// ============================================================
window.updateGroupMembers = async function (groupId, newMembers) {
    try {
        const groupRef = doc(db, 'groups', groupId);
        await updateDoc(groupRef, { members: newMembers });
        window.currentGroup.members = newMembers;
        const payerSelect = document.getElementById('payerSelect');
        if (payerSelect) {
            payerSelect.innerHTML = newMembers.map(m => `<option value="${m}">${m}</option>`).join('');
        }
        renderChart();
        renderExpenseLog();
        renderDashboard();
        alert('Members updated!');
    } catch (err) {
        console.error('Error updating members:', err);
    }
};

// ============================================================
//  SECTION 20: DELETE GROUP
// ============================================================
window.deleteGroup = async function (groupId) {
    try {
        if (activeGroupListener) { activeGroupListener(); activeGroupListener = null; }
        await deleteDoc(doc(db, 'groups', groupId));
        window.groups = window.groups.filter(g => g.id !== groupId);
        window.currentGroup = null;
        renderDashboard();
        window.showPage('dashboard');
    } catch (err) {
        console.error('Error deleting group:', err);
    }
};

// ============================================================
//  SECTION 21: RENAME GROUP
// ============================================================
window.renameGroup = async function (groupId, newName) {
    try {
        const groupRef = doc(db, 'groups', groupId);
        await updateDoc(groupRef, { name: newName });
        window.currentGroup.name = newName;
        const idx = window.groups.findIndex(g => g.id === groupId);
        if (idx !== -1) window.groups[idx].name = newName;
        document.getElementById('groupTitle').innerText = newName;
        renderDashboard();
        alert('Group renamed!');
    } catch (err) {
        console.error('Error renaming group:', err);
    }
};

// ============================================================
//  SECTION 22: TAB SWITCHER
// ============================================================
window.switchTab = function (tab) {
    if (tab === 'signin') {
        document.getElementById('signInForm').style.display = 'block';
        document.getElementById('signUpForm').style.display = 'none';
        document.getElementById('forgotPanel').style.display = 'none';
        document.getElementById('signInTab').classList.add('active-tab');
        document.getElementById('signUpTab').classList.remove('active-tab');
    } else {
        document.getElementById('signUpForm').style.display = 'block';
        document.getElementById('signInForm').style.display = 'none';
        document.getElementById('forgotPanel').style.display = 'none';
        document.getElementById('signUpTab').classList.add('active-tab');
        document.getElementById('signInTab').classList.remove('active-tab');
    }
};

// ============================================================
//  SECTION 23: AUTO REMINDERS (every 24h)
// ============================================================
function startAutoReminders() {
    stopAutoReminders();
    checkAndAutoRemind();
    autoReminderInterval = setInterval(checkAndAutoRemind, 24 * 60 * 60 * 1000);
}

function stopAutoReminders() {
    if (autoReminderInterval) { clearInterval(autoReminderInterval); autoReminderInterval = null; }
}

function checkAndAutoRemind() {
    if (!window.notificationsEnabled) return;
    if (!window.groups || window.groups.length === 0) return;
    window.groups.forEach(group => {
        if (!group.expenses || group.expenses.length === 0) return;
        const owedMap = {};
        (group.members || []).forEach(m => owedMap[m] = 0);
        (group.expenses || []).forEach(exp => {
            (group.members || []).forEach(m => {
                if (m !== exp.payer) {
                    const amt = exp.splits ? exp.splits[m] : (exp.amount / (group.members || []).length);
                    owedMap[m] += amt || 0;
                }
            });
        });
        (group.settled || []).forEach(s => { owedMap[s.member] = Math.max(0, (owedMap[s.member] || 0) - s.amount); });
        const debtors = Object.entries(owedMap).filter(([, amt]) => amt > 0.01);
        if (debtors.length > 0 && Notification.permission === 'granted') {
            debtors.forEach(([member, amt]) => {
                new Notification(`⏰ Auto-reminder: ${member} owes money!`, {
                    body: `${member} owes ${window.currentCurrency || '₹'}${amt.toFixed(2)} in ${group.name}`,
                    icon: 'logo.png'
                });
            });
        }
    });
}

// ============================================================
//  SECTION 24: NOTIFICATION BADGE UPDATE — UPDATED for read/unread
// ============================================================
window.updateNotifBadge = function () {
    const badge = document.getElementById('notifBadge');
    if (!badge) return;

    // Count unread in-app notifications — NEW
    const unread = (window.notificationLog || []).filter(n => !n.read).length;

    // Also count groups with outstanding debts
    let debtCount = 0;
    (window.groups || []).forEach(group => {
        const owedMap = {};
        (group.members || []).forEach(m => owedMap[m] = 0);
        (group.expenses || []).forEach(exp => {
            (group.members || []).forEach(m => {
                if (m !== exp.payer) {
                    const amt = exp.splits ? exp.splits[m] : (exp.amount / (group.members || []).length);
                    owedMap[m] += amt || 0;
                }
            });
        });
        (group.settled || []).forEach(s => { owedMap[s.member] = Math.max(0, (owedMap[s.member] || 0) - s.amount); });
        debtCount += Object.values(owedMap).filter(v => v > 0.01).length;
    });

    const total = unread + debtCount;
    if (total > 0) { badge.style.display = 'block'; badge.textContent = total > 9 ? '9+' : total; }
    else { badge.style.display = 'none'; }
};

export { auth, db };