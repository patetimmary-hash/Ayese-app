import { API } from './api.js';

let isSignUp = false;

function showApp() {
  document.getElementById('authScreen').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  document.getElementById('userName').textContent = API.user?.name || API.user?.email || 'Account';
}

function showAuth() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('app').style.display = 'none';
}

function toggleMode() {
  isSignUp = !isSignUp;
  document.getElementById('nameField').style.display = isSignUp ? 'block' : 'none';
  document.getElementById('authSubmit').textContent = isSignUp ? 'Create account' : 'Sign in';
  document.querySelector('#authToggle').innerHTML = isSignUp
    ? 'Already have an account? <a href="#" id="toggleLink">Sign in</a>'
    : 'New to Ayese? <a href="#" id="toggleLink">Create an account</a>';
  document.getElementById('authError').textContent = '';
  document.getElementById('authPassword').setAttribute('autocomplete', isSignUp ? 'new-password' : 'current-password');
  bindToggle();
}

function bindToggle() {
  document.getElementById('toggleLink')?.addEventListener('click', e => { e.preventDefault(); toggleMode(); });
}

async function handleSubmit(e) {
  e.preventDefault();
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const name = document.getElementById('authName').value.trim();
  const errEl = document.getElementById('authError');
  const btn = document.getElementById('authSubmit');
  errEl.textContent = '';
  btn.disabled = true;
  btn.textContent = isSignUp ? 'Creating...' : 'Signing in...';
  try {
    const data = isSignUp
      ? await API.register(email, password, name)
      : await API.login(email, password);
    API.setSession(data.token, data.user);
    showApp();
    window.dispatchEvent(new Event('ayese:authed'));
  } catch (err) {
    errEl.textContent = err.message;
    btn.disabled = false;
    btn.textContent = isSignUp ? 'Create account' : 'Sign in';
  }
}

async function initGoogle() {
  try {
    const { googleClientId } = await API.config();
    if (!googleClientId || !window.google) {
      document.getElementById('googleBtnWrap').innerHTML =
        '<p class="muted" style="font-size:.78rem;">Google sign-in not configured</p>';
      return;
    }
    window.google.accounts.id.initialize({
      client_id: googleClientId,
      callback: async (response) => {
        try {
          const data = await API.googleAuth(response.credential);
          API.setSession(data.token, data.user);
          showApp();
          window.dispatchEvent(new Event('ayese:authed'));
        } catch (err) {
          document.getElementById('authError').textContent = err.message;
        }
      },
    });
    window.google.accounts.id.renderButton(
      document.getElementById('googleBtnWrap'),
      { type: 'standard', size: 'large', text: 'continue_with', shape: 'pill', width: 280 }
    );
  } catch {
    document.getElementById('googleBtnWrap').innerHTML = '';
  }
}

// Init
bindToggle();
document.getElementById('authForm').addEventListener('submit', handleSubmit);
document.getElementById('logoutBtn').addEventListener('click', () => {
  API.logout();
  showAuth();
});
initGoogle();

if (API.isLoggedIn()) {
  // Verify token is still valid
  API.me().then(() => {
    showApp();
    window.dispatchEvent(new Event('ayese:authed'));
  }).catch(() => {
    API.logout();
    showAuth();
  });
} else {
  showAuth();
}

export { showApp, showAuth };
