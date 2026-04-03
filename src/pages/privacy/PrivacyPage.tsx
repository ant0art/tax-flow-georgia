import './PrivacyPage.css';

export function PrivacyPage() {
  return (
    <div className="privacy-page">
      <div className="privacy-container">
        <h1>Privacy Policy</h1>
        <p className="privacy-updated">Last updated: April 4, 2026</p>

        <section>
          <h2>Overview</h2>
          <p>
            Tax Flow Georgia is a personal finance tool for sole proprietors in Georgia.
            It helps track income, invoices, and tax declarations. Your privacy is important
            to us, and this policy explains how the application handles your data.
          </p>
        </section>

        <section>
          <h2>Data Storage</h2>
          <p>
            <strong>All your data is stored in your own Google Drive.</strong> Tax Flow Georgia
            uses Google Sheets as a database — your financial data lives in a spreadsheet
            within your Google account. We do not have a backend server or database that stores
            your information.
          </p>
          <ul>
            <li>We <strong>never</strong> store your financial data on our servers</li>
            <li>We <strong>never</strong> have access to your Google password</li>
            <li>We <strong>never</strong> share your data with third parties</li>
            <li>You can delete all your data by simply deleting the spreadsheet from your Google Drive</li>
          </ul>
        </section>

        <section>
          <h2>Google Account Access</h2>
          <p>
            Tax Flow Georgia requests the following permissions from your Google account:
          </p>
          <ul>
            <li>
              <strong>Google Sheets API</strong> — to read and write your financial data
              (invoices, transactions, declarations) in a dedicated spreadsheet
            </li>
            <li>
              <strong>Google Drive (file-level access)</strong> — to create and manage
              only the spreadsheet files created by this application. We cannot see or
              access any other files in your Drive.
            </li>
          </ul>
          <p>
            You can revoke access at any time through your{' '}
            <a
              href="https://myaccount.google.com/permissions"
              target="_blank"
              rel="noopener noreferrer"
            >
              Google Account permissions
            </a>.
          </p>
        </section>

        <section>
          <h2>RS.GE Integration (Optional)</h2>
          <p>
            If you choose to connect your RS.GE (Revenue Service) account, the application
            communicates with RS.GE through a secure proxy to fetch and submit tax declarations.
          </p>
          <ul>
            <li>Your RS.GE credentials are <strong>never stored</strong> — they are used only
              during the active session</li>
            <li>Session tokens are encrypted with AES-256-GCM and expire after 50 minutes</li>
            <li>All communication happens over HTTPS</li>
          </ul>
        </section>

        <section>
          <h2>Cookies &amp; Analytics</h2>
          <p>
            Tax Flow Georgia does not use cookies, tracking pixels, or analytics services.
            We do not track your behavior or collect usage statistics.
          </p>
        </section>

        <section>
          <h2>Open Source</h2>
          <p>
            The application's source code is publicly available on{' '}
            <a
              href="https://github.com/ant0art/tax-flow-georgia"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>. You can inspect exactly what the application does with your data.
          </p>
        </section>

        <section>
          <h2>Contact</h2>
          <p>
            If you have questions about this privacy policy, please open an issue on{' '}
            <a
              href="https://github.com/ant0art/tax-flow-georgia/issues"
              target="_blank"
              rel="noopener noreferrer"
            >
              GitHub
            </a>.
          </p>
        </section>

        <div className="privacy-back">
          <a href="#/login">← Back to app</a>
        </div>
      </div>
    </div>
  );
}
