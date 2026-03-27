import { useState } from 'react';
import { pdf } from '@react-pdf/renderer';
import { InvoicePDF } from './InvoicePDF';
import type { InvoiceFormData, InvoiceItem } from '@/entities/invoice/schemas';
import { useSettings } from '@/features/settings/hooks/useSettings';
import { useClients } from '@/features/clients/hooks/useClients';
import { Button } from '@/shared/ui/Button';
import { Icon } from '@/shared/ui/Icon';
import { useToastStore } from '@/shared/ui/Toast.store';
import { useT } from '@/shared/i18n/useT';

interface Props {
  invoice: InvoiceFormData;
  items: InvoiceItem[];
}

export function InvoicePDFButton({ invoice, items }: Props) {
  const { settings } = useSettings();
  const { clients } = useClients();
  const [loading, setLoading] = useState(false);
  const t = useT();

  const handleDownload = async () => {
    setLoading(true);
    try {
      // Resolve business entity if selected
      const entity = invoice.businessEntityId && settings?.businessEntities?.length
        ? settings.businessEntities.find((e) => e.id === invoice.businessEntityId)
        : undefined;

      const pdfSettings = entity
        ? {
            fullName: entity.fullName,
            tin: entity.tin,
            address: entity.address,
            email: entity.email,
            bankName: entity.bankName,
            beneficiary: entity.beneficiary,
            iban: entity.iban,
            swift: entity.swift,
          }
        : settings ?? undefined;

      // Lookup live client record for address/tin (not snapshotted — display-only)
      const clientRecord = clients.find((c) => c.id === invoice.clientId);

      // Bank details: prefer snapshotted values; fall back to live client account
      // (fallback covers old invoices created before clientBankName was added to schema)
      let resolvedBankName = invoice.clientBankName ?? '';
      let resolvedIban = invoice.clientIban ?? '';

      if (!resolvedBankName && !resolvedIban && clientRecord?.accounts?.length) {
        // Try to find account matching invoice currency; otherwise take first account
        const matchingAccount =
          clientRecord.accounts.find((a) => a.currency === invoice.currency) ??
          clientRecord.accounts[0];
        resolvedBankName = matchingAccount.bankName ?? '';
        resolvedIban = matchingAccount.iban ?? '';
      }

      const clientPdf = {
        bankName: resolvedBankName,
        iban: resolvedIban,
        address: clientRecord?.address ?? '',
        tin: clientRecord?.tin ?? '',
      };

      const blob = await pdf(
        <InvoicePDF invoice={invoice} items={items} t={t} settings={pdfSettings} client={clientPdf} />
      ).toBlob();

      const url = URL.createObjectURL(blob);
      // Open in new tab — bypasses Chrome's automatic download restrictions
      // User can save via Ctrl+S or browser PDF viewer's download button
      const tab = window.open(url, '_blank');
      if (!tab) {
        // Fallback if popup blocked: try direct download
        const a = document.createElement('a');
        a.href = url;
        a.download = `invoice-${invoice.number}.pdf`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
      // Revoke after delay so new tab has time to load the blob
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      console.error('PDF generation failed:', err);
      useToastStore.getState().addToast(t['pdf_error'] ?? 'Ошибка генерации PDF', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={handleDownload}
      loading={loading}
      title={t['invoice_download_pdf'] ?? 'Download PDF'}
    >
      <Icon name="download" size={15} />
    </Button>
  );
}
