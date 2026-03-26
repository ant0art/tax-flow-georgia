import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { InvoicePDF } from './InvoicePDF';
import type { InvoiceFormData, InvoiceItem } from '@/entities/invoice/schemas';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { Button } from '@/shared/ui/Button';
import { useToastStore } from '@/shared/ui/Toast.store';

interface Props {
  invoice: InvoiceFormData;
  items: InvoiceItem[];
}

export function InvoicePDFButton({ invoice, items }: Props) {
  const { settings } = useSettings();
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const blob = await pdf(
        <InvoicePDF invoice={invoice} items={items} settings={settings ?? undefined} />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice-${invoice.number}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF generation failed:', err);
      useToastStore.getState().addToast('Ошибка генерации PDF', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button size="sm" variant="ghost" onClick={handleDownload} loading={loading}>
      📥
    </Button>
  );
}
