import { useToastStore } from '@/shared/ui/Toast.store';

/**
 * Fetch NBG (National Bank of Georgia) exchange rate for a given currency and date.
 * API: https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?currencies=USD&date=2024-01-15
 *
 * Edge cases:
 * - Weekends/holidays: NBG returns last available rate
 * - API unavailable: returns 0 and shows toast
 */
export async function fetchNBGRate(currency: string, date: string): Promise<number> {
  if (currency === 'GEL') return 1;

  try {
    const url = `https://nbg.gov.ge/gw/api/ct/monetarypolicy/currencies/en/json/?currencies=${currency}&date=${date}`;
    const res = await fetch(url);

    if (!res.ok) {
      throw new Error(`NBG API: ${res.status}`);
    }

    const data = await res.json();

    // NBG response: [{ currencies: [{ code: "USD", rate: 2.6541, ... }] }]
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('NBG: empty response');
    }

    const currencies = data[0]?.currencies;
    if (!Array.isArray(currencies) || currencies.length === 0) {
      throw new Error('NBG: no currency data');
    }

    const rate = currencies[0]?.rate;
    if (typeof rate !== 'number' || rate <= 0) {
      throw new Error('NBG: invalid rate');
    }

    return rate;
  } catch (err) {
    console.error('NBG rate fetch failed:', err);
    useToastStore.getState().addToast(
      `Не удалось получить курс ${currency} из NBG. Введите вручную.`,
      'error'
    );
    return 0;
  }
}
