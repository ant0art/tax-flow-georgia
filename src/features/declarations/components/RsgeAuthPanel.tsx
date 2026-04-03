import { useState, useRef, useEffect } from 'react';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Icon } from '@/shared/ui/Icon';
import { useT } from '@/shared/i18n/useT';
import type { RsgeAuthState } from '@/features/declarations/hooks/useRsgeAuth';

interface RsgeAuthPanelProps {
  state: RsgeAuthState;
  error: string | null;
  onInitAuth: (login: string, password: string) => void;
  onConfirmOtp: (code: string) => void;
  onDisconnect: () => void;
}

export function RsgeAuthPanel({
  state,
  error,
  onInitAuth,
  onConfirmOtp,
  onDisconnect,
}: RsgeAuthPanelProps) {
  const t = useT();

  return (
    <div className={`rsge-auth${state === 'connected' ? ' rsge-auth--connected' : ''}`}>
      <div className="rsge-auth__inner">
        {/* Connected — single compact bar */}
        {state === 'connected' ? (
          <div className="rsge-auth__bar">
            <div className="rsge-auth__bar-left">
              <div className="rsge-auth__icon-wrap">
                <Icon name="unlock" size={16} />
              </div>
              <div className="rsge-auth__titles">
                <h3 className="rsge-auth__title">{t['rsge_connected']}</h3>
                <p className="rsge-auth__subtitle">{t['rsge_connected_hint']}</p>
              </div>
            </div>
            <div className="rsge-auth__bar-right">
              <div className="rsge-security-badge">
                <Icon name="lock" size={10} />
                {t['rsge_security_note']}
              </div>
              <div className="rsge-connected__info">
                <span className="rsge-connected__pulse" />
                <span className="rsge-connected__text">{t['rsge_session_active']}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={onDisconnect}>
                {t['rsge_disconnect']}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Not connected — header + form */}
            <div className="rsge-auth__header">
              <div className="rsge-auth__icon-wrap">
                <Icon name="lock" size={18} />
              </div>
              <div className="rsge-auth__titles">
                <h3 className="rsge-auth__title">{t['rsge_connect_title']}</h3>
                <p className="rsge-auth__subtitle">{t['rsge_connect_hint']}</p>
              </div>
              <div className="rsge-security-badge">
                <Icon name="lock" size={10} />
                {t['rsge_security_note']}
              </div>
            </div>

            {error && (
              <div className="rsge-error">
                <Icon name="alert-triangle" size={16} />
                <span>{error}</span>
              </div>
            )}

            {(state === 'idle' || state === 'loading' || state === 'error') && (
              <CredentialsForm
                onSubmit={onInitAuth}
                loading={state === 'loading'}
              />
            )}

            {(state === 'otp' || state === 'authenticating') && (
              <OtpForm
                onSubmit={onConfirmOtp}
                loading={state === 'authenticating'}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* ── Credentials form ── */

function CredentialsForm({
  onSubmit,
  loading,
}: {
  onSubmit: (login: string, password: string) => void;
  loading: boolean;
}) {
  const t = useT();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (login.trim() && password.trim()) {
      onSubmit(login.trim(), password.trim());
    }
  };

  return (
    <form className="rsge-auth__form rsge-step-enter" onSubmit={handleSubmit}>
      <div className="rsge-auth__form-row">
        <Input
          label={t['rsge_login']}
          id="rsge-login"
          placeholder={t['rsge_login_placeholder']}
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          autoComplete="username"
          disabled={loading}
        />
        <Input
          label={t['rsge_password']}
          id="rsge-password"
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          disabled={loading}
        />
      </div>
      <div className="rsge-auth__actions">
        <Button
          type="submit"
          size="sm"
          loading={loading}
          disabled={!login.trim() || !password.trim()}
        >
          {t['rsge_connect_btn']}
        </Button>
      </div>
    </form>
  );
}

/* ── OTP form with individual digit inputs ── */

function OtpForm({
  onSubmit,
  loading,
}: {
  onSubmit: (code: string) => void;
  loading: boolean;
}) {
  const t = useT();
  const [digits, setDigits] = useState(['', '', '', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    // Only accept digits
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);

    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 4 digits entered
    if (digit && index === 3 && next.every((d) => d)) {
      onSubmit(next.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (text.length > 0) {
      const next = ['', '', '', ''];
      for (let i = 0; i < text.length; i++) next[i] = text[i];
      setDigits(next);
      // Focus last filled or submit
      const focusIdx = Math.min(text.length, 3);
      inputRefs.current[focusIdx]?.focus();
      if (text.length === 4) {
        onSubmit(text);
      }
    }
  };

  const handleManualSubmit = () => {
    const code = digits.join('');
    if (code.length === 4) onSubmit(code);
  };

  return (
    <div className="rsge-otp rsge-step-enter">
      <p className="rsge-otp__hint">{t['rsge_otp_hint']}</p>
      <div className="rsge-otp__fields" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            className={`rsge-otp__digit${d ? ' rsge-otp__digit--filled' : ''}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={loading}
            aria-label={`${t['rsge_otp_digit']} ${i + 1}`}
          />
        ))}
      </div>
      <div className="rsge-otp__actions">
        <Button
          size="sm"
          loading={loading}
          disabled={digits.some((d) => !d)}
          onClick={handleManualSubmit}
        >
          {t['rsge_otp_submit']}
        </Button>
      </div>
    </div>
  );
}
