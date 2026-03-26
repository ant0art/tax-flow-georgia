import { useEffect, useRef, useState } from 'react';
import { SettingsForm } from '@/features/settings/components/SettingsForm';
import { useT } from '@/shared/i18n/useT';
import { Icon } from '@/shared/ui/Icon';
import './SettingsPage.css';

const NAV_SECTIONS = [
  { id: 'section-personal', icon: 'user'    as const, labelKey: 'settings_personal' },
  { id: 'section-bank',     icon: 'bank'    as const, labelKey: 'settings_bank'     },
  { id: 'section-defaults', icon: 'sliders' as const, labelKey: 'settings_defaults' },
];

export function SettingsPage() {
  const t = useT();
  const [activeId, setActiveId] = useState<string>('section-personal');
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const targets = NAV_SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Pick the topmost visible section
        const visible = entries.filter(e => e.isIntersecting);
        if (visible.length > 0) {
          const top = visible.reduce((a, b) =>
            a.boundingClientRect.top < b.boundingClientRect.top ? a : b
          );
          setActiveId(top.target.id);
        }
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: 0 }
    );

    targets.forEach(el => observerRef.current!.observe(el));
    return () => observerRef.current?.disconnect();
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="settings-page">
      <div>
        <h1 className="page-title settings-page__title">
          <Icon name="settings" size={22} />
          {t['settings_title']}
        </h1>
        <p className="settings-page__subtitle">
          {t['settings_subtitle']}
        </p>
      </div>

      <div className="settings-layout">
        {/* ── Main form column ── */}
        <div className="settings-layout__form">
          <SettingsForm />
        </div>

        {/* ── Sticky jump navigation ── */}
        <nav className="settings-nav" aria-label="Settings sections">
          <span className="settings-nav__label">On this page</span>
          {NAV_SECTIONS.map(({ id, icon, labelKey }) => (
            <button
              key={id}
              type="button"
              className={`settings-nav__link${activeId === id ? ' active' : ''}`}
              onClick={() => scrollTo(id)}
            >
              <Icon name={icon} size={12} />
              {t[labelKey as keyof typeof t] ?? labelKey}
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
