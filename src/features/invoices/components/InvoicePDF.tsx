import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
import type { InvoiceFormData, InvoiceItem } from '@/entities/invoice/schemas';

const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', GEL: '₾',
};

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontFamily: 'Helvetica',
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
  title: { fontSize: 22, fontFamily: 'Helvetica-Bold', color: '#B83A2D' },
  invoiceNumber: { fontSize: 10, color: '#6B6560', marginTop: 4 },
  dateBlock: { alignItems: 'flex-end' },
  dateLabel: { fontSize: 8, color: '#9A918A' },
  dateValue: { fontSize: 10, fontFamily: 'Helvetica-Bold' },

  parties: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20, gap: 20 },
  partyBlock: { flex: 1 },
  partyLabel: { fontSize: 8, color: '#9A918A', marginBottom: 4, textTransform: 'uppercase' as const },
  partyName: { fontSize: 11, fontFamily: 'Helvetica-Bold', marginBottom: 2 },
  partyDetail: { fontSize: 9, color: '#6B6560', lineHeight: 1.5 },

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
  totalValue: { fontSize: 10, fontFamily: 'Helvetica-Bold' },
  grandTotal: {
    flexDirection: 'row', width: 200, justifyContent: 'space-between',
    borderTopWidth: 1, borderTopColor: '#1A1A1A',
    paddingTop: 4, marginTop: 4,
  },
  grandLabel: { fontSize: 12, fontFamily: 'Helvetica-Bold' },
  grandValue: { fontSize: 12, fontFamily: 'Helvetica-Bold', color: '#B83A2D' },

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
}

export function InvoicePDF({ invoice, items, settings }: Props) {
  const sym = CURRENCY_SYMBOLS[invoice.currency] ?? invoice.currency;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>INVOICE</Text>
            <Text style={styles.invoiceNumber}>{invoice.number}</Text>
          </View>
          <View style={styles.dateBlock}>
            <Text style={styles.dateLabel}>Submitted on</Text>
            <Text style={styles.dateValue}>{invoice.date}</Text>
            <Text style={{ ...styles.dateLabel, marginTop: 8 }}>Due date</Text>
            <Text style={styles.dateValue}>{invoice.dueDate}</Text>
          </View>
        </View>

        {/* Parties */}
        <View style={styles.parties}>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Invoice for</Text>
            <Text style={styles.partyName}>{invoice.clientName}</Text>
            {invoice.project && <Text style={styles.partyDetail}>Project: {invoice.project}</Text>}
          </View>
          <View style={styles.partyBlock}>
            <Text style={styles.partyLabel}>Payable to</Text>
            <Text style={styles.partyName}>{settings?.fullName ?? ''}</Text>
            {settings?.tin && <Text style={styles.partyDetail}>TIN: {settings.tin}</Text>}
            {settings?.address && <Text style={styles.partyDetail}>{settings.address}</Text>}
            {settings?.email && <Text style={styles.partyDetail}>{settings.email}</Text>}
          </View>
        </View>

        {/* Banking */}
        {settings?.bankName && (
          <View style={{ marginBottom: 16 }}>
            <Text style={styles.partyLabel}>Banking Details</Text>
            <Text style={styles.partyDetail}>Beneficiary: {settings.beneficiary}</Text>
            <Text style={styles.partyDetail}>Account: {settings.iban}</Text>
            <Text style={styles.partyDetail}>Bank: {settings.bankName}</Text>
            <Text style={styles.partyDetail}>SWIFT: {settings.swift}</Text>
          </View>
        )}

        {/* Items table */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={{ ...styles.colDesc, ...styles.colHeadText }}>Description</Text>
            <Text style={{ ...styles.colQty, ...styles.colHeadText }}>Qty</Text>
            <Text style={{ ...styles.colPrice, ...styles.colHeadText }}>Unit Price</Text>
            <Text style={{ ...styles.colTotal, ...styles.colHeadText }}>Total</Text>
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colPrice}>{sym}{Number(item.unitPrice).toFixed(2)}</Text>
              <Text style={styles.colTotal}>{sym}{Number(item.total).toFixed(2)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>{sym}{Number(invoice.subtotal).toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>{invoice.vatText}</Text>
            <Text style={styles.totalValue}>{sym}{Number(invoice.vatAmount).toFixed(2)}</Text>
          </View>
          <View style={styles.grandTotal}>
            <Text style={styles.grandLabel}>Total</Text>
            <Text style={styles.grandValue}>{sym}{Number(invoice.total).toFixed(2)}</Text>
          </View>
        </View>

        {/* Notes */}
        {invoice.notes && <Text style={styles.notes}>Notes: {invoice.notes}</Text>}

        {/* Footer */}
        <Text style={styles.footer}>
          Generated by Tax Flow Georgia • {invoice.number}
        </Text>
      </Page>
    </Document>
  );
}
