/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// Google Identity Services (GIS) — loaded by @react-oauth/google
interface Window {
  google?: {
    accounts: {
      oauth2: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          prompt: string;
          callback: (response: { access_token?: string; error?: string }) => void;
        }) => {
          requestAccessToken: (overrides?: {
            prompt?: string;
            login_hint?: string;
          }) => void;
        };
      };
    };
  };
}
