# Tax Flow Georgia 🇬🇪

Персональное веб-приложение для учёта доходов, инвойсов и налогов индивидуального предпринимателя в Грузии. Все данные хранятся в вашей Google Spreadsheet — никакого бэкенда.

## ⚡ Stack

| | |
|---|---|
| **Framework** | React 19 + TypeScript + Vite 8 |
| **State** | Zustand (auth, UI, toast) |
| **Data** | TanStack Query → Google Sheets API |
| **Forms** | React Hook Form + Zod |
| **PDF** | @react-pdf/renderer |
| **Charts** | Recharts |
| **Auth** | Google OAuth 2.0 (implicit flow) |
| **Deploy** | GitHub Pages |

## 🚀 Quick Start

### 1. Создайте Google Cloud проект

1. Откройте [Google Cloud Console](https://console.cloud.google.com/)
2. Создайте новый проект или выберите существующий
3. Включите APIs:
   - **Google Sheets API**
   - **Google Drive API**
4. Перейдите в **APIs & Services → Credentials**
5. Нажмите **Create Credentials → OAuth client ID**
6. Тип: **Web application**
7. Authorized JavaScript origins:
   - `http://localhost:5173` (dev)
   - `https://<your-username>.github.io` (production)
8. Authorized redirect URIs:
   - `http://localhost:5173`
   - `https://<your-username>.github.io/tax-flow-georgia/`
9. Скопируйте **Client ID**

### 2. Настройте проект

```bash
git clone https://github.com/<your-username>/tax-flow-georgia.git
cd tax-flow-georgia
npm install
cp .env.example .env
```

Вставьте Client ID в `.env`:

```
VITE_GOOGLE_CLIENT_ID=your-client-id-here.apps.googleusercontent.com
```

### 3. Запустите

```bash
npm run dev
```

Приложение откроется на `http://localhost:5173/tax-flow-georgia/`

## 📁 Архитектура (FSD)

```
src/
├── app/              # App entry, router, providers, global styles
├── pages/            # Route pages (home, invoices, transactions, settings)
├── features/         # Domain logic
│   ├── auth/         # Google OAuth store, spreadsheet init
│   ├── settings/     # Settings form + hooks
│   ├── clients/      # Clients CRUD
│   ├── invoices/     # Invoice form, list, PDF
│   ├── transactions/ # Transaction form, NBG rates
│   └── dashboard/    # Charts + summary stats
├── entities/         # Zod schemas
│   ├── settings/
│   ├── client/
│   ├── invoice/
│   └── transaction/
└── shared/           # Reusable layer
    ├── api/          # SheetsClient, NBG rate fetcher
    ├── hooks/        # useTheme, useDraftPersist
    └── ui/           # Input, Button, Toast, AppLayout
```

## 🔒 Безопасность

- **Токен в памяти** — access token хранится в Zustand, не в localStorage
- **Минимальные scopes** — только `spreadsheets` + `drive.file`
- **CSP** — Content Security Policy в `index.html`
- **Нет серверной части** — данные только в вашем Google аккаунте

## 📦 Deploy

Push в `main` → GitHub Actions автоматически:
1. `npm ci` → `tsc --noEmit` → `vite build`
2. Deploy в GitHub Pages

Для ручного деплоя:

```bash
npm run build
```

## 🇬🇪 NBG курсы

Приложение автоматически загружает курс валют из [Национального Банка Грузии](https://nbg.gov.ge):
- При создании транзакции курс загружается по выбранной дате
- Если API недоступен — введите курс вручную
- Выходные/праздники: NBG возвращает последний доступный курс

## 📄 License

MIT
