import { SettingsForm } from '@/features/settings/components/SettingsForm';
import { ClientList } from '@/features/clients/components/ClientList';
import { useT } from '@/shared/i18n/useT';
import { Icon } from '@/shared/ui/Icon';
import './SettingsPage.css';

export function SettingsPage() {
  const t = useT();
  return (
    <div className="settings-page">
      <h1 className="page-title settings-page__title">
        <Icon name="settings" size={22} />
        {t['settings_title']}
      </h1>
      <p className="settings-page__subtitle">
        {t['settings_subtitle']}
      </p>

      <SettingsForm />

      <div className="settings-page__divider" />

      <ClientList />
    </div>
  );
}
