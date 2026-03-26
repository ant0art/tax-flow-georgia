import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '@/features/auth/store';
import { useUIStore } from '@/shared/hooks/useTheme';
import { useT } from '@/shared/i18n/useT';
import { Icon } from '@/shared/ui/Icon';
import './AppLayout.css';

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const { theme, toggleTheme, lang, toggleLang, sidebarCollapsed, toggleSidebar } = useUIStore();
  const t = useT();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const collapsed = sidebarCollapsed;

  return (
    <div className="app-layout">
      {/* ── LEFT SIDEBAR (desktop) / BOTTOM NAV (mobile) ── */}
      <nav
        className={`app-nav${collapsed ? ' app-nav--collapsed' : ''}`}
        aria-label="Main navigation"
      >
        {/* Logo + collapse toggle */}
        <div className={`app-nav__head${collapsed ? ' app-nav__head--collapsed' : ''}`}>
          {!collapsed && (
            <div className="app-nav__logo" aria-hidden="true">
              <Icon name="chart-bar" size={18} />
              <span>Tax Flow</span>
            </div>
          )}
          <button
            className="sidebar-toggle"
            onClick={toggleSidebar}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <Icon name={collapsed ? 'chevron-right' : 'chevron-left'} size={16} />
          </button>
        </div>

        {/* Nav items */}
        <NavLink to="/" className="app-nav__item" end title={t['nav_home']}>
          <Icon name="home" size={18} />
          {!collapsed && <span className="app-nav__label">{t['nav_home']}</span>}
        </NavLink>
        <NavLink to="/invoices" className="app-nav__item" title={t['nav_invoices']}>
          <Icon name="file-text" size={18} />
          {!collapsed && <span className="app-nav__label">{t['nav_invoices']}</span>}
        </NavLink>
        <NavLink to="/transactions" className="app-nav__item" title={t['nav_income']}>
          <Icon name="dollar-sign" size={18} />
          {!collapsed && <span className="app-nav__label">{t['nav_income']}</span>}
        </NavLink>
        <NavLink to="/settings" className="app-nav__item" title={t['nav_settings']}>
          <Icon name="settings" size={18} />
          {!collapsed && <span className="app-nav__label">{t['nav_settings']}</span>}
        </NavLink>

        {/* Controls — always at the bottom */}
        <div className="sidebar-controls">
          <button
            className="sidebar-control-btn"
            onClick={toggleTheme}
            title={theme === 'light' ? t['theme_dark'] : t['theme_light']}
          >
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={16} />
            {!collapsed && <span>{theme === 'light' ? t['theme_dark'] : t['theme_light']}</span>}
          </button>

          <button
            className="sidebar-control-btn"
            onClick={toggleLang}
            title={lang === 'en' ? 'Switch to Russian' : 'Switch to English'}
          >
            <Icon name="globe" size={16} />
            {!collapsed && <span>{lang === 'en' ? 'RU' : 'EN'}</span>}
          </button>

          {user && (
            <div className="sidebar-user">
              {!collapsed && (user.picture ? (
                <img
                  className="sidebar-user__avatar"
                  src={user.picture}
                  alt={user.name}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="sidebar-user__initials">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              ))}
              <button
                className="sidebar-control-btn sidebar-user__logout"
                onClick={handleLogout}
                title={t['logout']}
              >
                <Icon name="log-out" size={15} />
                {!collapsed && <span>{t['logout']}</span>}
              </button>

            </div>
          )}
        </div>
      </nav>

      {/* ── MOBILE HEADER ── */}
      <header className="app-header">
        <div className="app-header__logo">
          <Icon name="chart-bar" size={20} className="app-header__logo-icon" />
          <span className="app-header__logo-text">Tax Flow</span>
        </div>
        <div className="app-header__actions">
          <button className="icon-btn" onClick={toggleTheme} title={t['theme_dark']}>
            <Icon name={theme === 'light' ? 'moon' : 'sun'} size={18} />
          </button>
          <button className="icon-btn lang-toggle" onClick={toggleLang}>
            <Icon name="globe" size={16} />
            <span className="lang-toggle__label">{lang === 'en' ? 'RU' : 'EN'}</span>
          </button>
          {user && (
            <div className="user-badge">
              {user.picture ? (
                <img className="user-badge__avatar" src={user.picture} alt={user.name} referrerPolicy="no-referrer" />
              ) : (
                <div className="user-badge__initials">{user.name.charAt(0).toUpperCase()}</div>
              )}
              <button className="user-badge__logout" onClick={handleLogout} title={t['logout']}>
                <Icon name="log-out" size={15} />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* ── MAIN CONTENT ── */}
      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
