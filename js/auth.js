import { getAuth, signOut, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { auth } from './main.js';

const authForm = document.getElementById('auth-form');
const errorMessageDiv = document.getElementById('error-message');
const errorText = document.getElementById('error-text');
const logoutBtn = document.getElementById('logout-btn');

export function setupAuthEventListeners() {
    authForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            showError(getFriendlyErrorMessage(error.code));
        }
    });

    logoutBtn.addEventListener('click', () => signOut(auth).catch(console.error));
}

function showError(message) {
    errorText.textContent = message;
    errorMessageDiv.classList.remove('hidden');
}

function getFriendlyErrorMessage(code) {
    switch (code) {
        case 'auth/invalid-credential':
        case 'auth/user-not-found':
        case 'auth/wrong-password':
            return 'Email ou senha inválidos.';
        case 'auth/email-already-in-use':
            return 'Este email já está a ser utilizado.';
        case 'auth/weak-password':
            return 'A senha deve ter pelo menos 6 caracteres.';
        case 'auth/invalid-email':
            return 'O formato do email é inválido.';
        default:
            return 'Ocorreu um erro. Tente novamente.';
    }
}

