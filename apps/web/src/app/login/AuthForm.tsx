'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { authApi, type AuthChallenge } from '@/lib/api';
import styles from './auth.module.css';

export function AuthForm({ setup = false, redirectTo = '/' }: { setup?: boolean; redirectTo?: string }) {
  const [challenge, setChallenge] = useState<AuthChallenge | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    setError('');
    try {
      if (!challenge) {
        const email = String(data.get('email') || '');
        const password = String(data.get('password') || '');
        if (setup && password !== data.get('confirmPassword')) throw new Error('Passwords do not match.');
        const result = setup
          ? await authApi.setup(email, password, String(data.get('setupToken') || ''))
          : await authApi.login(email, password);
        form.reset();
        setChallenge(result.data);
      } else {
        const result = challenge.enrollmentRequired
          ? await authApi.verifyEnrollment(challenge.ticket, String(data.get('code') || '').trim())
          : await authApi.verifyMfa(challenge.ticket, String(data.get('code') || '').trim());
        form.reset();
        setChallenge(null);
        if (result.data.recoveryCodes?.length) setRecoveryCodes(result.data.recoveryCodes);
        else window.location.assign(redirectTo);
      }
    } catch (err) {
      if (challenge) {
        setChallenge(null);
        setError(`${err instanceof Error ? err.message : 'Verification failed'}. This challenge is closed; sign in again to continue.`);
      } else setError(err instanceof Error ? err.message : 'Unable to authenticate. Try again later.');
    } finally { setBusy(false); }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card} aria-labelledby="auth-title">
        <p className={styles.eyebrow}>Personal AI Workspace</p>
        <h1 id="auth-title">{recoveryCodes.length ? 'Save your recovery codes' : challenge?.enrollmentRequired ? 'Set up your authenticator' : challenge ? 'Verify your identity' : setup ? 'Create your owner account' : 'Welcome back'}</h1>
        <p className={styles.intro}>{recoveryCodes.length ? 'These single-use codes are shown only once. Store them offline in a safe place. Each code can replace an authenticator code if you lose access.' : challenge?.enrollmentRequired ? 'Add the secret below to your authenticator app as a time-based (TOTP) account, then enter its six-digit code. Setup expires after five minutes.' : challenge ? 'Enter your authenticator code or an unused recovery code. The challenge expires after five minutes and is single use.' : setup ? 'One-time setup requires server-side opt-in, a setup token, and the exact configured owner email. Existing accounts and workspace data will not be adopted or reset.' : 'Sign in with your owner credentials. Your authenticator is required before a workspace session is created.'}</p>
        {error ? <p role="alert" className={styles.error}>{error}</p> : null}
        {recoveryCodes.length ? (
          <div className={styles.stack}>
            <ul className={styles.codes}>{recoveryCodes.map((code) => <li key={code}><code>{code}</code></li>)}</ul>
            <label className={styles.check}><input type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} /> I have saved these codes securely.</label>
            <button className={styles.primary} disabled={!saved} onClick={() => { setRecoveryCodes([]); window.location.assign(redirectTo); }}>Continue to workspace</button>
          </div>
        ) : (
          <form onSubmit={submit} className={styles.stack}>
            {challenge ? (
              <>
                {challenge.enrollmentRequired ? (
                  <div className={styles.secret}>
                    <p>Manual setup key</p>
                    <code>{challenge.secret}</code>
                    <p>Issuer: Personal AI Workspace · Time based · SHA-1 · 6 digits · 30 seconds</p>
                    {challenge.provisioningUri ? <a href={challenge.provisioningUri}>Open in an authenticator app</a> : null}
                    <p>A QR code is not available in this build. Use the manual key or authenticator link; never share this secret.</p>
                  </div>
                ) : null}
                <label htmlFor="code">{challenge.enrollmentRequired ? 'Authenticator code' : 'Authenticator or recovery code'}</label>
                <input id="code" name="code" autoComplete="one-time-code" inputMode={challenge.enrollmentRequired ? 'numeric' : 'text'} maxLength={80} required autoFocus />
              </>
            ) : (
              <>
                <label htmlFor="email">Owner email</label>
                <input id="email" name="email" type="email" autoComplete="username" maxLength={254} required />
                <label htmlFor="password">Password</label>
                <input id="password" name="password" type="password" autoComplete={setup ? 'new-password' : 'current-password'} minLength={setup ? 14 : 1} maxLength={256} required />
                {setup ? (
                  <>
                    <p className={styles.help}>Use a unique passphrase of at least 14 characters.</p>
                    <label htmlFor="confirmPassword">Confirm password</label>
                    <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" minLength={14} maxLength={256} required />
                    <label htmlFor="setupToken">One-time setup token</label>
                    <input id="setupToken" name="setupToken" type="password" autoComplete="off" minLength={32} maxLength={512} required />
                  </>
                ) : null}
              </>
            )}
            <button className={styles.primary} type="submit" disabled={busy}>{busy ? 'Please wait…' : challenge ? 'Verify and sign in' : setup ? 'Create account and enroll MFA' : 'Continue securely'}</button>
            {challenge ? <button className={styles.secondary} type="button" disabled={busy} onClick={() => { setChallenge(null); setError(''); }}>Start again</button> : null}
          </form>
        )}
        {!recoveryCodes.length && setup ? <p className={styles.footer}>Already started setup? <Link href="/login">Sign in to finish enrollment</Link></p> : null}
      </section>
    </main>
  );
}
