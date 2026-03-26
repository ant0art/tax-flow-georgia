import { useUIStore } from '@/shared/hooks/useTheme';
import { translations } from './translations';

// Cast to Record<string,string> so both EN (literal types) and RU values satisfy consuming code.
export type T = Record<string, string>;

export function useT(): T {
  const lang = useUIStore((s) => s.lang);
  return translations[lang] as T;
}
