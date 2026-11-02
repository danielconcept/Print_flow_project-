import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { formatMoney } from "@/lib/domain/money";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  header: { marginBottom: 20 },
  title: { fontSize: 18, fontWeight: "bold" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  section: { marginBottom: 12 },
  table: { marginTop: 12 },
  tableHeader: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e5e7eb", paddingBottom: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f3f4f6", paddingVertical: 4 },
  colDesc: { width: "40%" },
  colQty: { width: "15%", textAlign: "right" },
  colPrice: { width: "15%", textAlign: "right" },
  colTax: { width: "15%", textAlign: "right" },
  colTotal: { width: "15%", textAlign: "right" },
  totals: { marginTop: 12, alignItems: "flex-end" },
  totalRow: { flexDirection: "row", width: 200, justifyContent: "space-between", marginBottom: 2 },
});

export interface QuotationPdfData {
  quotationNumber: string;
  issueDate: string;
  validUntil?: string | null;
  company: { name: string; address?: string | null; email?: string | null; phone?: string | null };
  customer: { name: string; address?: string | null; phone?: string | null; email?: string | null };
  items: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPriceMinor: number;
    taxRateBp: number;
    totalMinor: number;
  }>;
  subtotalMinor: number;
  taxMinor: number;
  discountMinor: number;
  totalMinor: number;
  notes?: string | null;
  terms?: string | null;
}

export function QuotationPdf({ data }: { data: QuotationPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.row}>
            <View>
              <Text style={styles.title}>QUOTATION</Text>
              <Text>{data.quotationNumber}</Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text style={{ fontWeight: "bold" }}>{data.company.name}</Text>
              {data.company.address ? <Text>{data.company.address}</Text> : null}
              {data.company.email ? <Text>{data.company.email}</Text> : null}
              {data.company.phone ? <Text>{data.company.phone}</Text> : null}
            </View>
          </View>
        </View>

        <View style={[styles.section, styles.row]}>
          <View>
            <Text style={{ fontWeight: "bold", marginBottom: 2 }}>Quote To</Text>
            <Text>{data.customer.name}</Text>
            {data.customer.address ? <Text>{data.customer.address}</Text> : null}
            {data.customer.phone ? <Text>{data.customer.phone}</Text> : null}
            {data.customer.email ? <Text>{data.customer.email}</Text> : null}
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text>Issue Date: {data.issueDate}</Text>
            {data.validUntil ? <Text>Valid Until: {data.validUntil}</Text> : null}
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.colDesc}>Description</Text>
            <Text style={styles.colQty}>Qty</Text>
            <Text style={styles.colPrice}>Unit Price</Text>
            <Text style={styles.colTax}>Tax</Text>
            <Text style={styles.colTotal}>Total</Text>
          </View>
          {data.items.map((item, index) => (
            <View key={index} style={styles.tableRow}>
              <Text style={styles.colDesc}>{item.description}</Text>
              <Text style={styles.colQty}>
                {(item.quantity / 1000).toFixed(3).replace(/\.000$/, "")} {item.unit}
              </Text>
              <Text style={styles.colPrice}>{formatMoney(item.unitPriceMinor)}</Text>
              <Text style={styles.colTax}>{(item.taxRateBp / 100).toFixed(2)}%</Text>
              <Text style={styles.colTotal}>{formatMoney(item.totalMinor)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalRow}>
            <Text>Subtotal</Text>
            <Text>{formatMoney(data.subtotalMinor)}</Text>
          </View>
          {data.discountMinor > 0 ? (
            <View style={styles.totalRow}>
              <Text>Discount</Text>
              <Text>-{formatMoney(data.discountMinor)}</Text>
            </View>
          ) : null}
          <View style={styles.totalRow}>
            <Text>Tax</Text>
            <Text>{formatMoney(data.taxMinor)}</Text>
          </View>
          <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 4, marginTop: 4 }]}>
            <Text style={{ fontWeight: "bold" }}>Total</Text>
            <Text style={{ fontWeight: "bold" }}>{formatMoney(data.totalMinor)}</Text>
          </View>
        </View>

        {data.notes ? (
          <View style={[styles.section, { marginTop: 20 }]}>
            <Text style={{ fontWeight: "bold", marginBottom: 2 }}>Notes</Text>
            <Text>{data.notes}</Text>
          </View>
        ) : null}
        {data.terms ? (
          <View style={[styles.section, { marginTop: 12 }]}>
            <Text style={{ fontWeight: "bold", marginBottom: 2 }}>Terms & Conditions</Text>
            <Text>{data.terms}</Text>
          </View>
        ) : null}
      </Page>
    </Document>
  );
}
