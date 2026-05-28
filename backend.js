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
signInWithRedirect,
getRedirectResult,
    signOut,
    onAuthStateChanged,
    updateProfile
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

// Keep track of active listeners so we can unsubscribe
let activeGroupListener = null;

// ============================================================
//  SECTION 4: AUTH STATE LISTENER
// ============================================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        const name = user.displayName || user.email.split('@')[0];
        document.getElementById('sidebarName').textContent = name;
        loadGroups(user.uid);
        window.showPage('dashboard');
    } else {
        window.showPage('welcome');
    }
});

// ============================================================
//  SECTION 5: SIGN IN
// ============================================================
window.firebaseSignIn = function () {
    const email = document.getElementById('signInEmail').value.trim();
    const pass = document.getElementById('signInPass').value.trim();
    if (!email || !pass) { alert('Please enter email and password'); return; }
    signInWithEmailAndPassword(auth, email, pass)
        .then((result) => {
            const name = result.user.displayName || email.split('@')[0];
            document.getElementById('sidebarName').textContent = name;
            loadGroups(result.user.uid);
            window.showPage('dashboard');
        })
        .catch(() => alert('Wrong email or password!'));
};

// ============================================================
//  SECTION 6: SIGN UP — CHANGE 1: now saves name + username
// ============================================================
window.firebaseSignUp = function () {
    const fullName = document.getElementById('signUpName').value.trim();
    const username = document.getElementById('signUpUsername').value.trim().replace(/^@/, '').toLowerCase();
    const email = document.getElementById('signUpEmail').value.trim();
    const pass = document.getElementById('signUpPass').value.trim();

    if (!fullName) { alert('Please enter your full name'); return; }
    if (!username) { alert('Please enter a username'); return; }
    if (!email || !pass) { alert('Please enter email and password'); return; }

    // Check if username is already taken
    checkUsernameAvailable(username).then(available => {
        if (!available) {
            alert(`Username @${username} is already taken. Please choose another.`);
            return;
        }
        createUserWithEmailAndPassword(auth, email, pass)
            .then(async (result) => {
                // Save display name to Firebase Auth profile
                await updateProfile(result.user, { displayName: fullName });

                // Save user profile to Firestore 'users' collection
                await setDoc(doc(db, 'users', result.user.uid), {
                    uid: result.user.uid,
                    name: fullName,
                    username: username,
                    email: email,
                    createdAt: new Date()
                });

                document.getElementById('sidebarName').textContent = fullName;
                window.showPage('dashboard');
            })
            .catch(err => alert(err.message));
    });
};

// ============================================================
//  SECTION 6a: CHECK USERNAME AVAILABILITY
// ============================================================
async function checkUsernameAvailable(username) {
    try {
        const q = query(collection(db, 'users'), where('username', '==', username));
        const snap = await getDocs(q);
        return snap.empty; // true = available
    } catch (err) {
        console.error('Error checking username:', err);
        return true; // allow if check fails
    }
}

// ============================================================
//  SECTION 6b: LOOKUP USER BY USERNAME (for edit members)
//  CHANGE 2: Username-based member lookup
// ============================================================
window.lookupUserByUsername = async function(username) {
    try {
        const clean = username.replace(/^@/, '').toLowerCase();
        const q = query(collection(db, 'users'), where('username', '==', clean));
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return snap.docs[0].data(); // { uid, name, username, email }
    } catch (err) {
        console.error('Error looking up username:', err);
        return null;
    }
};

// ============================================================
//  SECTION 7: GOOGLE SIGN IN
// ============================================================
window.googleSignIn = function () {
    const provider = new GoogleAuthProvider();
    signInWithRedirect(auth, provider);
};

// ============================================================
//  SECTION 9: UPDATE USER PROFILE (display name)
// ============================================================
window.updateUserName = async function (newName) {
    const user = auth.currentUser;
    if (!user || !newName) return;
    try {
        await updateProfile(user, { displayName: newName });
        // Also update in Firestore users collection
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { name: newName });
        document.getElementById('sidebarName').textContent = newName;
        alert('Name updated!');
    } catch (err) {
        console.error('Error updating name:', err);
    }
};

// ============================================================
//  SECTION 10: SAVE GROUP TO FIRESTORE
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
//  SECTION 11: LOAD GROUPS FROM FIRESTORE
// ============================================================
window.loadGroups = async function (uid) {
    try {
        const q = query(collection(db, 'groups'), where('userId', '==', uid));
        const snapshot = await getDocs(q);
        window.groups = [];
        snapshot.forEach(d => {
            window.groups.push({ id: d.id, ...d.data() });
        });
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
//  SECTION 21: TAB SWITCHER (Sign In / Sign Up)
// ============================================================
window.switchTab = function (tab) {
    if (tab === 'signin') {
        document.getElementById('signInForm').style.display = 'block';
        document.getElementById('signUpForm').style.display = 'none';
        document.getElementById('signInTab').classList.add('active-tab');
        document.getElementById('signUpTab').classList.remove('active-tab');
    } else {
        document.getElementById('signUpForm').style.display = 'block';
        document.getElementById('signInForm').style.display = 'none';
        document.getElementById('signUpTab').classList.add('active-tab');
        document.getElementById('signInTab').classList.remove('active-tab');
    }
};

export { auth, db };