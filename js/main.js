import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-analytics.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, onSnapshot, query, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig } from './firebase-config.js';
import { setupAuthEventListeners } from './auth.js';
import { setupOsEventListeners, applyFiltersAndRender, updateCustomerDatalist } from './os.js';
import { initializeDashboard, updateDashboard } from './dashboard.js';
import { setupAdminListeners, updateAdminData } from './admin.js';

// --- VARIÁVEIS GLOBAIS EXPORTADAS ---
export let db, auth, osCollectionRef, usersCollectionRef, clientesCollectionRef;
export let allServiceOrders = [], allTechnicians = [], allCustomers = [];

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    const app = initializeApp(firebaseConfig);
    const analytics = getAnalytics(app);
    db = getFirestore(app);
    auth = getAuth(app);
    osCollectionRef = collection(db, 'ordens_servico');
    usersCollectionRef = collection(db, 'users');
    clientesCollectionRef = collection(db, 'clientes');

    const loadingState = document.getElementById('loading-state');
    const loginContainer = document.getElementById('login-container');
    const appContainer = document.getElementById('app-container');
    const userGreeting = document.getElementById('user-greeting');
    const adminTabBtn = document.getElementById('admin-tab-btn');
    
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            const userDoc = await getDoc(doc(usersCollectionRef, user.uid));
            const userData = userDoc.exists() ? userDoc.data() : null;

            userGreeting.textContent = `Bem-vindo, ${user.displayName || user.email}!`;
            if (userData && userData.role === 'admin') {
                adminTabBtn.classList.remove('hidden-element');
                setupAdminListeners();
            }

            setupRealtimeListeners();
            loadingState.classList.add('hidden-element');
            loginContainer.classList.add('hidden-element');
            appContainer.classList.remove('hidden-element');
        } else {
            loadingState.classList.add('hidden-element');
            appContainer.classList.add('hidden-element');
            loginContainer.classList.remove('hidden-element');
            adminTabBtn.classList.add('hidden-element');
        }
    });

    setupAuthEventListeners();
    setupOsEventListeners();

    const mainTabs = document.getElementById('main-tabs');
    const tabContents = document.querySelectorAll('.tab-content');

     mainTabs.addEventListener('click', (e) => {
        const button = e.target.closest('.tab-btn');
        if(!button) return;

        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');

        tabContents.forEach(content => content.classList.add('hidden-element'));
        const tabId = button.dataset.tab + '-tab';
        document.getElementById(tabId).classList.remove('hidden-element');

        if(button.dataset.tab === 'dashboard') {
            initializeDashboard();
            updateDashboard(allServiceOrders);
        }
    });
});

function setupRealtimeListeners() {
    onSnapshot(query(osCollectionRef, orderBy('timestamp', 'desc')), (snapshot) => {
        allServiceOrders = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        applyFiltersAndRender(allServiceOrders);
        if(!document.getElementById('dashboard-tab').classList.contains('hidden-element')) {
           updateDashboard(allServiceOrders);
        }
    });
    onSnapshot(query(usersCollectionRef, orderBy('name')), (snapshot) => {
        allTechnicians = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        updateAdminData(allServiceOrders, allTechnicians);
    });
    onSnapshot(query(clientesCollectionRef, orderBy('nome')), (snapshot) => {
        allCustomers = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
        updateCustomerDatalist(allCustomers);
        updateAdminData(allServiceOrders, allTechnicians, allCustomers);
    });
}

