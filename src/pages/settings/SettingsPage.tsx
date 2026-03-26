import { SettingsForm } from '@/features/settings/components/SettingsForm';
import { ClientList } from '@/features/clients/components/ClientList';
import './SettingsPage.css';

export function SettingsPage() {
  return (
    <div className="settings-page">
      <h1 className="settings-page__title">⚙️ Настройки</h1>
      <p className="settings-page__subtitle">
        Данные ИП, банковские реквизиты и предпочтения
      </p>

      <SettingsForm />

      <div className="settings-page__divider" />

      <ClientList />
    </div>
  );
}
