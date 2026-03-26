import { Providers } from './providers/Providers';
import { AppRouter } from './router';
import { ToastContainer } from '@/shared/ui/Toast';
import { useUIStore } from '@/shared/hooks/useTheme';
import { useEffect } from 'react';
import './styles/tokens.css';
import './styles/global.css';

function ThemeInit() {
  const theme = useUIStore((s) => s.theme);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return null;
}

export default function App() {
  return (
    <Providers>
      <ThemeInit />
      <AppRouter />
      <ToastContainer />
    </Providers>
  );
}
