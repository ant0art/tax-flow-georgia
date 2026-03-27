import { Document, Font, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { InvoiceFormData, InvoiceItem } from '@/entities/invoice/schemas';
// Vite resolves this to a hashed, absolute URL — no CSP issues, no runtime path guessing
import interTTF from '@/assets/fonts/Inter.ttf';

// ── Register Inter TTF (Cyrillic + Latin, served locally via Vite) ────────────
Font.register({
  family: 'Inter',
  fonts: [
    { src: interTTF, fontWeight: 400 },
    { src: interTTF, fontWeight: 600 },
    { src: interTTF, fontWeight: 700 },
  ],
});




Font.registerHyphenationCallback((word) => [word]);

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', GEL: '₾',
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Inter',
    fontSize: 10,
    color: '#1A1A1A',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 2,
    borderBottomColor: '#B83A2D',
  },
  titleBlock: {},
  title: { fontSize: 22, fontWeight: 700, color: '#B83A2D' },
  invoiceNumber: { fontSize: 10, color: '#6B6560', marginTop: 4 },
  dateBlock: { alignItems: 'flex-end' },
  dateLabel: { fontSize: 8, color: '#9A918A' },
  dateValue: { fontSize: 10, fontWeight: 600 },

  /* ── Two-column parties ── */
  parties: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 20,
  },
  partyCol: { flex: 1 },
  partyLabel: {
    fontSize: 8,
    color: '#9A918A',
    marginBottom: 4,
    textTransform: 'uppercase' as const,
  },
  partyName: { fontSize: 11, fontWeight: 700, marginBottom: 2 },
  partyDetail: { fontSize: 9, color: '#6B6560', lineHeight: 1.3 },

  /* Banking sub-section */
  bankingWrap: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 0.5,
    borderTopColor: '#D6D0C8',
  },

  table: { marginBottom: 20 },
  tableHead: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#D6D0C8',
    paddingBottom: 6,
    marginBottom: 6,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    borderBottomWidth: 0.5,
    borderBottomColor: '#E8E2D9',
  },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: 'center' as const },
  colPrice: { flex: 1, textAlign: 'right' as const },
  colTotal: { flex: 1, textAlign: 'right' as const },
  colHeadText: { fontSize: 8, color: '#9A918A', textTransform: 'uppercase' as const },

  totals: { alignItems: 'flex-end', marginBottom: 20 },
  totalRow: { flexDirection: 'row', width: 200, justifyContent: 'space-between', marginBottom: 3 },
  totalLabel: { fontSize: 10, color: '#6B6560' },
  totalValue: { fontSize: 10, fontWeight: 600 },
  grandTotal: {
    flexDirection: 'row', width: 200, justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#1A1A1A',
    paddingTop: 4, marginTop: 4,
  },
  grandLabel: { fontSize: 12, fontWeight: 700 },
  grandValue: { fontSize: 12, fontWeight: 700, color: '#B83A2D' },

  notes: { fontSize: 9, color: '#6B6560', marginTop: 12 },
  footer: {
    position: 'absolute', bottom: 30, left: 40, right: 40,
    borderTopWidth: 0.5, borderTopColor: '#D6D0C8',
    paddingTop: 8,
    fontSize: 8, color: '#9A918A', textAlign: 'center' as const,
  },
});

interface Props {
  invoice: InvoiceFormData;
  items: InvoiceItem[];
  t: Record<string, string>;
  settings?: {
    fullName: string;
    tin: string;
    address: string;
    email: string;
    bankName: string;
    beneficiary: string;
    iban: string;
    swift: string;
  };
  client?: {
    bankName?: string;
    iban?: string;
    address?: string;
    tin?: string;
  };
}

export function InvoicePDF({ invoice, items, t, settings, client }: Props) {
  const sym = CURRENCY_SYMBOLS[invoice.currency] ?? invoice.currency;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>{t.pdf_invoice_title}</Text>
            <Text style={styles.invoiceNumber}>{invoice.number}</Text>
          </View>
          <View style={styles.dateBlock}>
            <Text style={styles.dateLabel}>{t.pdf_submitted}</Text>
            <Text style={styles.dateValue}>{invoice.date}</Text>
            <Text style={{ ...styles.dateLabel, marginTop: 8 }}>{t.pdf_due}</Text>
            <Text style={styles.dateValue}>{invoice.dueDate}</Text>
          </View>
        </View>

        {/* ── Two-column: Invoice For | Payable To + Banking ── */}
        <View style={styles.parties}>
          {/* LEFT: Invoice For (client) */}
          <View style={styles.partyCol}>
            <Text style={styles.partyLabel}>{t.pdf_invoice_for}</Text>
            <Text style={styles.partyName}>{invoice.clientName}</Text>
            {client?.tin  && <Text style={styles.partyDetail}>{t.pdf_tin}: {client.tin}</Text>}
            {client?.address && <Text style={styles.partyDetail}>{client.address}</Text>}
            {invoice.project && <Text style={styles.partyDetail}>{t.pdf_project}{invoice.project}</Text>}
            {(client?.bankName || client?.iban) && (
              <View style={styles.bankingWrap}>
                <Text style={styles.partyLabel}>{t.pdf_banking}</Text>
                {client?.bankName && <Text style={styles.partyDetail}>{t.pdf_bank}: {client.bankName}</Text>}
                {client?.iban    && <Text style={styles.partyDetail}>{t.pdf_account}: {client.iban}</Text>}
              </View>
            )}
          </View>

          {/* RIGHT: Payable To (seller) + Banking Details */}
          <View style={styles.partyCol}>
            <Text style={styles.partyLabel}>{t.pdf_payable_to}</Text>
            <Text style={styles.partyName}>{settings?.fullName ?? ''}</Text>
            {settings?.tin && <Text style={styles.partyDetail}>{t.pdf_tin}: {settings.tin}</Text>}
            {settings?.address && <Text style={styles.partyDetail}>{settings.address}</Text>}
            {settings?.email && <Text style={styles.partyDetail}>{settings.email}</Text>}

            {/* Banking details grouped with seller */}
            {settings?.bankName && (
              <View style={styles.bankingWrap}>
                <Text style={styles.partyLabel}>{t.pdf_banking}</Text>
                <Text style={styles.partyDetail}>{t.pdf_beneficiary}: {settings.beneficiary}</Text>
                <Text style={styles.partyDetail}>{t.pdf_account}: {settings.iban}</Text>
                <Text style={styles.partyDetail}>{t.pdf_bank}: {settings.bankName}</Text>
                <Text style={styles.partyDetail}>{t.pdf_swift}: {settings.swift}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={{ ...styles.colDesc, ...styles.colHeadText }}>{t.pdf_col_desc}</Text>
            <Text style={{ ...styles.colQty, ...styles.colHeadText }}>{t.pdf_col_qty}</Text>
            <Text style={{ ...styles.colPrice, ...styles.colHeadText }}>{t.pdf_col_price}</Text>
            <Text style={{ ...styles.colTotal, ...styles.colHeadText }}>{t.pdf_col_total}</Text>
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colDesc}>{String(item.description)}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{sym}{Number(item.unitPrice).toFixed(2)}</Text>
              <Text style={styles.colTotal}>{sym}{Number(item.total).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.pdf_subtotal}</Text>
            <Text style={styles.totalValue}>{sym}{Number(invoice.subtotal).toFixed(2)}</Text>
          </View>
          {/* VAT: show vatText as value when zero-rated, otherwise show formatted amount */}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{t.pdf_vat}</Text>
            <Text style={styles.totalValue}>
              {Number(invoice.vatAmount) === 0
                ? (invoice.vatText || t.pdf_vat_zero)
                : `${sym}${Number(invoice.vatAmount).toFixed(2)}`}
            </Text>
          </View>
          <View style={styles.grandTotal}>
            <Text style={styles.grandLabel}>{t.pdf_grand_total}</Text>
            <Text style={styles.grandValue}>{sym}{Number(invoice.total).toFixed(2)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && <Text style={styles.notes}>{t.pdf_notes}{invoice.notes}</Text>}

        {/* Footer */}
        <Text style={styles.footer}>
          {t.pdf_footer} • {invoice.number}
        </Text>
      </Page>
    </Document>
  );
}
