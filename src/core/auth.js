/**
 * ShelfLife - Authentication & Session Management (src/core/auth.js)
 * 
 * Handles user authentication, email/password login/signup, Google OAuth,
 * session listeners, token refresh, bootloader transitions, and auth screen rendering.
 */

import { _supabase, DB } from './db.js';

/**
 * Returns the Supabase client instance, falling back to window if needed.
 */
function getSupabase() {
  return _supabase || (typeof window !== 'undefined' && (window._supabase || window.supabase));
}

export const Auth = {
  isSignUp: false,
  user: null,

  showLoginModal(mode) {
    if (mode === 'signup' && !this.isSignUp) {
      this.toggleMode();
    } else if (mode === 'signin' && this.isSignUp) {
      this.toggleMode();
    }
    const overlay = document.getElementById('authModalOverlay') || document.getElementById('authLoginDrawer');
    if (overlay) {
      overlay.classList.add('open');
      overlay.style.display = 'flex';
      const closeBtn = document.getElementById('authModalCloseBtn') || document.getElementById('authScreenCloseBtn');
      if (closeBtn) closeBtn.style.display = 'flex';
      const emailInput = document.getElementById('authEmail');
      if (emailInput) {
        setTimeout(() => emailInput.focus(), 80);
        if (!emailInput._trackBound) {
          emailInput._trackBound = true;
          emailInput.addEventListener('input', () => {
            if (!emailInput._typedFired && emailInput.value.length >= 3) {
              emailInput._typedFired = true;
              if (DB && typeof DB.trackEvent === 'function') {
                DB.trackEvent('auth_email_typed', { mode: this.isSignUp ? 'signup' : 'signin' });
              }
            }
          });
        }
      }
    }
    if (DB && typeof DB.trackEvent === 'function') {
      DB.trackEvent('auth_modal_opened', { mode: this.isSignUp ? 'signup' : 'signin', trigger: mode || 'modal' });
    }
  },

  hideLoginModal() {
    const overlay = document.getElementById('authModalOverlay') || document.getElementById('authLoginDrawer');
    if (overlay) {
      overlay.classList.remove('open');
      overlay.style.display = 'none';
    }
  },

  showLoginDrawer() {
    this.showLoginModal();
  },

  hideLoginDrawer() {
    this.hideLoginModal();
  },

  toggleLoginDrawer() {
    const overlay = document.getElementById('authModalOverlay') || document.getElementById('authLoginDrawer');
    if (overlay && (overlay.classList.contains('open') || overlay.style.display === 'flex' || overlay.style.display === 'block')) {
      this.hideLoginModal();
    } else {
      this.showLoginModal();
    }
  },

  /**
   * Toggles between Sign In and Sign Up form states.
   */
  toggleMode() {
    this.isSignUp = !this.isSignUp;

    const titleEl = document.getElementById('authModalTitle');
    if (titleEl) {
      titleEl.innerHTML = this.isSignUp ? 'Create Your <em>Library</em>' : 'Welcome to Your <em>Study</em>';
    }

    const subEl = document.getElementById('authModalSub');
    if (subEl) {
      subEl.textContent = this.isSignUp ? 'Sign up to curate your personal bookshelf and track your reading journey' : 'Sign in to sync your library across your devices';
    }

    const userGroup = document.getElementById('authUsernameGroup');
    if (userGroup) userGroup.style.display = this.isSignUp ? 'block' : 'none';

    const submitBtn = document.getElementById('authSubmitBtn');
    if (submitBtn) submitBtn.textContent = this.isSignUp ? 'Create Account' : 'Sign In';

    const promptEl = document.getElementById('authTogglePrompt');
    if (promptEl) {
      promptEl.textContent = this.isSignUp ? 'Already have an account?' : 'Need an account?';
    }

    const toggleBtn = document.getElementById('authToggleBtn');
    if (toggleBtn) {
      toggleBtn.textContent = this.isSignUp ? 'Sign In' : 'Sign Up';
    }

    const errEl = document.getElementById('authError');
    if (errEl) errEl.textContent = '';
  },

  /**
   * Submits email & password for sign in or account registration.
   */
  async submitEmail() {
    const emailEl = document.getElementById('authEmail');
    const passEl = document.getElementById('authPassword');
    const usernameEl = document.getElementById('authUsername');
    const errEl = document.getElementById('authError');
    const btn = document.getElementById('authSubmitBtn');

    const email = emailEl ? emailEl.value.trim() : '';
    const password = passEl ? passEl.value : '';
    const username = usernameEl ? usernameEl.value.trim() : '';

    if (errEl) {
      errEl.textContent = '';
      errEl.style.color = 'var(--dislike)';
    }

    const client = getSupabase();
    if (!client) {
      if (errEl) errEl.textContent = 'Supabase not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY.';
      return;
    }

    if (this.isSignUp && !username) {
      if (errEl) errEl.textContent = 'Please choose a username.';
      return;
    }
    if (!email || !password) {
      if (errEl) errEl.textContent = 'Please enter email and password.';
      return;
    }
    if (password.length < 6) {
      if (errEl) errEl.textContent = 'Password must be at least 6 characters.';
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Please wait...';
    }

    if (DB && typeof DB.trackEvent === 'function') {
      DB.trackEvent('auth_submit_clicked', { mode: this.isSignUp ? 'signup' : 'signin' });
    }

    try {
      let result;
      if (this.isSignUp) {
        result = await client.auth.signUp({
          email,
          password,
          options: {
            data: { username },
            emailRedirectTo: this.getRedirectUrl()
          }
        });
      } else {
        result = await client.auth.signInWithPassword({ email, password });
      }

      if (result.error) {
        if (errEl) errEl.textContent = result.error.message;
        if (btn) {
          btn.disabled = false;
          btn.textContent = this.isSignUp ? 'Sign Up' : 'Sign In';
        }
        return;
      }

      if (this.isSignUp && DB && typeof DB.trackEvent === 'function') {
        DB.trackEvent('signup_completed', { email_confirm_required: !result.data?.session });
      }

      if (!this.isSignUp || result.data?.session) {
        this.hideLoginModal();
        this.showBootLoader('animated');
      }

      if (this.isSignUp && result.data?.user && !result.data.session) {
        if (errEl) {
          errEl.style.color = 'var(--like)';
          errEl.textContent = 'Check your email for a confirmation link!';
        }
        if (btn) {
          btn.disabled = false;
          btn.textContent = 'Sign Up';
        }
        return;
      }
    } catch (e) {
      if (errEl) errEl.textContent = 'Something went wrong. Try again.';
      if (btn) {
        btn.disabled = false;
        btn.textContent = this.isSignUp ? 'Sign Up' : 'Sign In';
      }
    }
  },

  /**
   * Computes canonical redirect URL for OAuth authentication.
   * Normalizes directory paths with trailing slash and strips index.html so Supabase
   * URL allow-list matches cleanly without falling back to the parent domain.
   */
  getRedirectUrl() {
    if (typeof window === 'undefined') return undefined;
    const origin = window.location.origin;
    if (!origin || origin === 'null' || origin === 'file://') return undefined;
    let path = window.location.pathname || '/';
    // Strip trailing index.html so redirects match canonical directory
    path = path.replace(/\/index\.html$/i, '/');
    // Ensure trailing slash on directory paths (e.g. /NoteToShelf -> /NoteToShelf/)
    if (!path.endsWith('/') && !path.includes('.')) {
      path += '/';
    }
    return origin + path;
  },

  /**
   * Initiates Google OAuth authentication flow.
   */
  async signInWithGoogle() {
    if (typeof window === 'undefined') return;
    const origin = window.location.origin;

    // Check for pending club invite in URL before redirect
    const rawHash = window.location.hash || '';
    const match = rawHash.match(/^#(?:club|invite)\/([^/?&#]+)/);
    if (match && match[1]) {
      try {
        localStorage.setItem('sl_pending_club_invite', decodeURIComponent(match[1]));
      } catch (e) {}
    }

    if (!origin || origin === 'null' || origin === 'file://') {
      const msg = 'Google Sign-In requires the app to be hosted on a real domain (not file://). Please run a local web server.';
      if (typeof alert === 'function') alert(msg);
      const errEl = document.getElementById('authError');
      if (errEl) errEl.innerHTML = msg;
      return;
    }

    try {
      if (DB && typeof DB.trackEvent === 'function') {
        DB.trackEvent('auth_submit_clicked', { mode: 'oauth_google' });
      }
      const client = getSupabase();
      const authObj = client?.auth;
      if (!authObj) {
        const msg = 'Google Sign-In requires an active Supabase connection.';
        const errEl = document.getElementById('authError');
        if (errEl) errEl.textContent = msg;
        return;
      }

      const { error } = await authObj.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: this.getRedirectUrl() }
      });

      if (error) {
        if (typeof alert === 'function') alert('Could not initiate Google Sign In: ' + error.message);
        const errEl = document.getElementById('authError');
        if (errEl) errEl.textContent = error.message;
      }
    } catch (err) {
      if (typeof alert === 'function') alert('Could not initiate Google Sign In: ' + (err?.message || err));
      const errEl = document.getElementById('authError');
      if (errEl) errEl.textContent = 'Could not initiate Google Sign In: ' + (err?.message || err);
      console.error('[Auth] signInWithGoogle failed:', err);
    }
  },

  /**
   * Signs out current user, clears cached tokens, and resets app state.
   */
  async signOut() {
    try {
      const app = (typeof window !== 'undefined' && window.App) || {};
      if (typeof app.closeSlideMenu === 'function') app.closeSlideMenu();
    } catch (e) {
      console.warn(e);
    }

    try {
      const client = getSupabase();
      if (client) {
        await Promise.race([
          client.auth.signOut().catch(() => {}),
          new Promise(res => setTimeout(res, 1500))
        ]);
      }
    } catch (e) {
      console.warn('[Auth] Sign out network error:', e);
    }

    try {
      if (typeof localStorage !== 'undefined') {
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith('sb-') || k.indexOf('-auth-token') !== -1) {
            localStorage.removeItem(k);
          }
        });
      }
    } catch (e) {
      console.warn(e);
    }

    try {
      if (typeof document !== 'undefined') {
        document.documentElement.classList.remove('has-returning-session');
      }
    } catch (e) {}

    this.user = null;

    if (typeof window !== 'undefined' && window.App) {
      window.App.userId = null;
      window.App.books = [];
      window.App.currentShelf = null;
    }

    if (typeof window !== 'undefined') {
      window.location.hash = '';
    }

    this.showAuthScreen();
  },

  /**
   * Displays the animated boot loader screen.
   */
  showBootLoader(mode = 'animated') {
    const splash = (typeof window !== 'undefined' && window.Splash) ? window.Splash : null;
    if (mode === 'static') {
      if (splash && typeof splash.showStaticSplash === 'function') {
        splash.showStaticSplash();
      } else {
        const b = document.getElementById('authBootLoader');
        if (b) {
          b.style.display = 'flex';
          b.style.opacity = '1';
          b.classList.add('splash-static');
        }
      }
    } else {
      if (splash && typeof splash.showAnimatedSplash === 'function') {
        splash.showAnimatedSplash();
      } else if (typeof window !== 'undefined' && typeof window.replayAnimation === 'function') {
        window.replayAnimation();
      } else {
        const b = document.getElementById('authBootLoader');
        if (b) {
          b.style.display = 'flex';
          b.style.opacity = '1';
          b.classList.remove('splash-static');
        }
      }
    }
  },

  /**
   * Fades out and dismisses the bootloader screen.
   */
  hideBootLoader(fast = false) {
    if (this._bootTimeout) clearTimeout(this._bootTimeout);
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('has-returning-session');
      document.documentElement.classList.add('auth-ready');
    }
    const splash = (typeof window !== 'undefined' && window.Splash) ? window.Splash : null;
    if (splash && typeof splash.dismissSplash === 'function') {
      splash.dismissSplash(fast);
    } else {
      const b = document.getElementById('authBootLoader');
      if (b) {
        const startTime = (typeof window !== 'undefined' && window.splashStartTime) ? window.splashStartTime : Date.now();
        const elapsed = Date.now() - startTime;
        const remaining = fast ? 0 : Math.max(0, 2800 - elapsed);
        setTimeout(() => {
          b.style.opacity = '0';
          b.classList.add('splash-out');
          setTimeout(() => { b.style.display = 'none'; }, 800);
        }, remaining);
      }
    }
  },

  /**
   * Hides authentication screen and displays main application workspace.
   */
  hideAuthScreen() {
    this.hideBootLoader();

    const s = document.getElementById('authScreen');
    if (s) {
      s.classList.add('hidden');
      setTimeout(() => {
        s.style.display = 'none';
      }, 400);
    }

    const ma = document.getElementById('mainApp');
    if (ma) ma.style.display = 'block';

    const bn = document.getElementById('bottomNav');
    if (bn) {
      bn.style.display = 'flex';
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.add('has-bottom-nav');
      }
    }

    const app = (typeof window !== 'undefined' && window.App) || {};
    if (typeof app._setActiveTab === 'function') {
      app._setActiveTab('home');
    }

    try {
      if (typeof app._refreshSocialBadge === 'function') app._refreshSocialBadge();
    } catch (e) {
      console.warn(e);
    }

    if (!app.isReadOnly) {
      const fa = document.getElementById('fabAdd');
      if (fa) fa.style.display = '';
      const fs = document.getElementById('fabShare');
      if (fs) fs.style.display = '';
      if (typeof app._applyMenuAvatar === 'function') {
        app._applyMenuAvatar();
      }
    }
  },

  /**
   * Displays authentication screen and hides main application workspace.
   */
  showAuthScreen() {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.remove('has-returning-session');
      document.documentElement.classList.add('auth-ready');
    }

    // Capture pending club invite if navigating logged-out
    if (typeof window !== 'undefined' && window.location.hash) {
      const rawHash = window.location.hash || '';
      const match = rawHash.match(/^#(?:club|invite)\/([^/?&#]+)/);
      if (match && match[1]) {
        try {
          localStorage.setItem('sl_pending_club_invite', decodeURIComponent(match[1]));
        } catch (e) {}
      }
    }

    this.hideBootLoader();

    const s = document.getElementById('authScreen');
    if (s) {
      s.style.display = 'flex';
      s.classList.remove('hidden');
    }

    if (DB && typeof DB.trackEvent === 'function') {
      DB.trackEvent('page_view', { mode: 'landing_anonymous' });
      DB.trackEvent('auth_modal_opened', { mode: 'auth_screen', trigger: 'landing' });
    }

    const closeBtn = document.getElementById('authScreenCloseBtn');
    if (closeBtn) {
      const app = (typeof window !== 'undefined' && window.App) || {};
      closeBtn.style.display = app.isReadOnly ? 'block' : 'none';
    }

    const ma = document.getElementById('mainApp');
    if (ma) ma.style.display = 'none';

    const bn = document.getElementById('bottomNav');
    if (bn) {
      bn.style.display = 'none';
      if (typeof document !== 'undefined' && document.body) {
        document.body.classList.remove('has-bottom-nav');
      }
    }

    const fa = document.getElementById('fabAdd');
    if (fa) fa.style.display = 'flex';
    const fs = document.getElementById('fabShare');
    if (fs) fs.style.display = 'flex';
    const ds = document.getElementById('demoSignInBtn');
    if (ds) ds.style.display = '';
    const ab = document.getElementById('accountBtn');
    if (ab) ab.style.display = '';
  },

  /**
   * Safe dev fallback for mock user login button.
   */
  loginAsMockUser() {
    if (typeof window !== 'undefined' && window.App && typeof window.App.startDemo === 'function') {
      window.App.startDemo();
    } else {
      this.hideAuthScreen();
    }
  }
};

/**
 * Manually processes the OAuth redirect hash (#access_token=...&refresh_token=...).
 * Avoids Supabase implicit flow bad_oauth_state errors on mobile browsers/PWAs.
 * @returns {Promise<boolean>} True if tokens were parsed and session restored.
 */
export async function handleOAuthRedirect() {
  const client = getSupabase();
  if (!client || typeof window === 'undefined') return false;

  const rawHash = window.location.hash || '';
  const hash = rawHash.replace(/^#/, '');
  if (!hash) return false;

  const params = new URLSearchParams(hash);
  if (params.get('error') && !params.get('access_token')) {
    const desc = params.get('error_description') || params.get('error');
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    if (desc) window._authRedirectError = decodeURIComponent(desc.replace(/\+/g, ' '));
    return false;
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    const { error } = await client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    if (error) {
      window._authRedirectError = error.message;
      return false;
    }
    return true;
  }
  return false;
}

/**
 * Initializes the Supabase auth state change listener.
 * @param {Function} [onUserAuthenticated] Callback when user is signed in or token refreshed.
 * @param {Function} [onSignOut] Callback when user signs out.
 */
export function initAuthListener(onUserAuthenticated, onSignOut) {
  const client = getSupabase();
  if (!client) return;

  try {
    client.auth.onAuthStateChange(function(event, session) {
      try {
        if (event === 'SIGNED_OUT') {
          Auth.user = null;
          if (typeof onSignOut === 'function') {
            onSignOut();
          } else {
            const isDemo = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('demo') === 'true' || (window.App && window.App.isDemoMode));
            if (!isDemo) Auth.showAuthScreen();
          }
          return;
        }

        if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session && session.user) {
          Auth.user = session.user;
          if (typeof onUserAuthenticated === 'function') {
            onUserAuthenticated(session.user);
          } else {
            Auth.hideAuthScreen();
          }
        }
      } catch (ex) {
        console.error('[Auth] onAuthStateChange callback error:', ex);
      }
    });
  } catch (ex) {
    console.error('[Auth] onAuthStateChange setup error:', ex);
  }
}

/**
 * Checks for existing session or OAuth redirect and boots the app.
 * @param {Function} [onUserAuthenticated] Callback when active session is found.
 * @param {Function} [onNoSession] Callback when no session is found.
 */
export async function restoreSession(onUserAuthenticated, onNoSession) {
  const isDemo = typeof window !== 'undefined' && (new URLSearchParams(window.location.search).get('demo') === 'true' || (window.App && window.App.isDemoMode));
  if (isDemo) return;

  const client = getSupabase();
  if (!client) {
    Auth.showAuthScreen();
    return;
  }

  // Check if hash has a club invite before OAuth redirect processing wipes hash
  const rawHash = (typeof window !== 'undefined' && window.location.hash) || '';
  const match = rawHash.match(/^#(?:club|invite)\/([^/?&#]+)/);
  if (match && match[1]) {
    try {
      localStorage.setItem('sl_pending_club_invite', match[1]);
    } catch (e) {}
  }

  try {
    await handleOAuthRedirect();
  } catch (e) {
    console.warn('[Auth] redirect handling failed:', e);
  }

  try {
    const { data: { session } } = await client.auth.getSession();
    if (session && session.user) {
      Auth.user = session.user;
      if (typeof onUserAuthenticated === 'function') {
        await onUserAuthenticated(session.user);
      } else {
        Auth.hideAuthScreen();
      }
    } else {
      if (typeof onNoSession === 'function') {
        onNoSession();
      } else {
        Auth.showAuthScreen();
      }

      if (typeof window !== 'undefined' && window._authRedirectError) {
        const errEl = document.getElementById('authError');
        if (errEl) errEl.textContent = window._authRedirectError;
      }
    }
  } catch (e) {
    console.error('[Auth] getSession failed:', e);
    if (typeof onNoSession === 'function') {
      onNoSession();
    } else {
      Auth.showAuthScreen();
    }
  }
}

// Global Window Bindings
if (typeof window !== 'undefined') {
  window.Auth = Auth;
  window.handleOAuthRedirect = handleOAuthRedirect;
  window.initAuthListener = initAuthListener;
  window.restoreSession = restoreSession;
}

export default Auth;
