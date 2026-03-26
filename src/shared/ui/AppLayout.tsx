import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';
import { useUIStore } from '@/shared/hooks/useTheme';
import './AppLayout.css';

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggleTheme } = useUIStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      {/* Top bar */}
      <header className="app-header">
        <div className="app-header__logo">
          <span className="app-header__logo-icon">📊</span>
          <span className="app-header__logo-text">Tax Flow</span>
        </div>

        <div className="app-header__actions">
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>

          {user && (
            <div className="user-badge">
              {user.picture ? (
                <img
                  className="user-badge__avatar"
                  src={user.picture}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="user-badge__initials">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <button className="user-badge__logout" onClick={handleLogout}>
                Выйти
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="app-main">
        <Outlet />
      </main>

      {/* Bottom navigation (mobile) */}
      <nav className="app-nav" aria-label="Main navigation">
        <NavLink to="/" className="app-nav__item" end>
          <span className="app-nav__icon">🏠</span>
          <span className="app-nav__label">Главная</span>
        </NavLink>
        <NavLink to="/invoices" className="app-nav__item">
          <span className="app-nav__icon">📄</span>
          <span className="app-nav__label">Инвойсы</span>
        </NavLink>
        <NavLink to="/transactions" className="app-nav__item">
          <span className="app-nav__icon">💰</span>
          <span className="app-nav__label">Доходы</span>
        </NavLink>
        <NavLink to="/settings" className="app-nav__item">
          <span className="app-nav__icon">⚙️</span>
          <span className="app-nav__label">Настройки</span>
        </NavLink>
      </nav>
    </div>
  );
}
