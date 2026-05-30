import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';

type OAuthProvider = 'google' | 'apple';

const REDIRECT_KEY = 'uhs_post_login_redirect';

function oauthRedirectUrl(redirectTo: string): string {
  const callback = new URL('/auth/callback', window.location.origin);
  callback.searchParams.set('redirect', redirectTo);
  return callback.toString();
}

function shouldUseLovableBroker(): boolean {
  const host = window.location.hostname;
  return !['localhost', '127.0.0.1', '::1'].includes(host);
}

export function persistPostLoginRedirect(redirectTo: string) {
  try {
    sessionStorage.setItem(REDIRECT_KEY, redirectTo);
  } catch {
    // OAuth still works if sessionStorage is unavailable.
  }
}

export function clearPostLoginRedirect() {
  try {
    sessionStorage.removeItem(REDIRECT_KEY);
  } catch {
    // Ignore unavailable storage.
  }
}

export async function startOAuthSignIn(provider: OAuthProvider, redirectTo: string) {
  persistPostLoginRedirect(redirectTo);
  const redirectUri = oauthRedirectUrl(redirectTo);

  if (shouldUseLovableBroker()) {
    const result = await lovable.auth.signInWithOAuth(provider, {
      redirect_uri: redirectUri,
      extraParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    });

    if (result.redirected) return { error: null, redirected: true };
    if (result.error) return { error: result.error, redirected: false };
    return { error: null, redirected: false };
  }

  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: redirectUri,
      queryParams: {
        access_type: 'offline',
        prompt: 'select_account',
      },
    },
  });

  return { error, redirected: !error };
}

export function describeOAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (/provider is not enabled|unsupported provider/i.test(message)) {
    return 'Login Google ainda não está habilitado no Supabase Auth. Ative o provider Google e inclua /auth/callback nas Redirect URLs.';
  }
  if (/popup/i.test(message)) {
    return 'O navegador bloqueou a janela de login. Libere pop-ups para este site e tente novamente.';
  }
  return message || 'Não foi possível iniciar o login com Google.';
}
