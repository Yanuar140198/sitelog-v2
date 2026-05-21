import { Html, Head, Body, Container, Heading, Text, Section, Row, Column, Hr, render } from '@react-email/components';

interface Props {
  orgName: string;
  plan: string;
  amount: number;
  currency: string;
  invoiceNumber: string;
  paidAt: string;
  receiptUrl?: string;
}

export function PaymentReceiptEmail(props: Props) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: '-apple-system, sans-serif', backgroundColor: '#FAFAF7' }}>
        <Container style={{ maxWidth: 560, margin: '40px auto', padding: 24, backgroundColor: 'white', border: '2px solid #0A0A0A' }}>
          <Text style={{ color: '#FF5500', fontFamily: 'monospace', letterSpacing: 2, fontSize: 11, margin: 0 }}>SITELOG · PAYMENT RECEIPT</Text>
          <Heading style={{ fontSize: 26, marginTop: 12 }}>Thank you for your payment.</Heading>
          <Text>Your Sitelog subscription for <strong>{props.orgName}</strong> has been renewed.</Text>

          <Section style={{ marginTop: 24, padding: 20, backgroundColor: '#FAFAF7', border: '1px solid #ddd' }}>
            <Row><Column><Text style={{ margin: 0, fontFamily: 'monospace', fontSize: 11, color: '#666' }}>PLAN</Text></Column><Column align="right"><Text style={{ margin: 0, fontWeight: 'bold' }}>{props.plan.toUpperCase()}</Text></Column></Row>
            <Row><Column><Text style={{ margin: 0, fontFamily: 'monospace', fontSize: 11, color: '#666' }}>INVOICE</Text></Column><Column align="right"><Text style={{ margin: 0, fontFamily: 'monospace' }}>{props.invoiceNumber}</Text></Column></Row>
            <Row><Column><Text style={{ margin: 0, fontFamily: 'monospace', fontSize: 11, color: '#666' }}>PAID</Text></Column><Column align="right"><Text style={{ margin: 0, fontFamily: 'monospace' }}>{props.paidAt}</Text></Column></Row>
            <Hr style={{ borderColor: '#ddd', margin: '12px 0' }} />
            <Row><Column><Text style={{ margin: 0, fontWeight: 'bold' }}>TOTAL</Text></Column><Column align="right"><Text style={{ margin: 0, fontWeight: 'bold', fontSize: 18, color: '#FF5500' }}>{props.currency} {props.amount}</Text></Column></Row>
          </Section>

          {props.receiptUrl && (
            <Text style={{ marginTop: 16 }}>
              <a href={props.receiptUrl} style={{ color: '#FF5500' }}>Download PDF receipt →</a>
            </Text>
          )}

          <Hr style={{ borderColor: '#eee', margin: '32px 0 16px' }} />
          <Text style={{ color: '#888', fontSize: 12, fontFamily: 'monospace' }}>
            SITELOG · construction SaaS · Questions? billing@sitelog.app
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderPaymentReceipt(props: Props): Promise<string> {
  return render(<PaymentReceiptEmail {...props} />);
}
