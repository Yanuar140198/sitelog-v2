import { Html, Head, Body, Container, Heading, Text, Section, Row, Column, Hr, render } from '@react-email/components';

interface ProjectRow {
  code: string;
  name: string;
  earnedValue: number;
  grandTotal: number;
  spi: number | null;
  progressPct: number;
}

interface Props {
  orgName: string;
  weekLabel: string;
  projects: ProjectRow[];
  totalEarned: number;
  totalPlanned: number;
}

const fmtIDR = (n: number) => `Rp ${n.toLocaleString('id-ID', { maximumFractionDigits: 0 })}`;

export function WeeklyDigestEmail({ orgName, weekLabel, projects, totalEarned, totalPlanned }: Props) {
  const progressPct = totalPlanned > 0 ? (totalEarned / totalPlanned) * 100 : 0;
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: '-apple-system, sans-serif', backgroundColor: '#FAFAF7' }}>
        <Container style={{ maxWidth: 640, margin: '40px auto', padding: 24, backgroundColor: 'white', border: '2px solid #0A0A0A' }}>
          <Text style={{ color: '#FF5500', fontFamily: 'monospace', letterSpacing: 2, fontSize: 11, margin: 0 }}>SITELOG · WEEKLY DIGEST</Text>
          <Heading style={{ fontSize: 26, marginTop: 12, marginBottom: 6 }}>{orgName}</Heading>
          <Text style={{ color: '#666', fontFamily: 'monospace', fontSize: 12, marginTop: 0 }}>{weekLabel}</Text>

          <Section style={{ marginTop: 24, padding: 16, backgroundColor: '#0A0A0A', color: 'white' }}>
            <Row>
              <Column>
                <Text style={{ color: '#FF5500', fontSize: 10, letterSpacing: 1, fontFamily: 'monospace', margin: 0 }}>EARNED</Text>
                <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', margin: 0 }}>{fmtIDR(totalEarned)}</Text>
              </Column>
              <Column>
                <Text style={{ color: '#FF5500', fontSize: 10, letterSpacing: 1, fontFamily: 'monospace', margin: 0 }}>PROGRESS</Text>
                <Text style={{ color: 'white', fontSize: 20, fontWeight: 'bold', margin: 0 }}>{progressPct.toFixed(1)}%</Text>
              </Column>
            </Row>
          </Section>

          <Heading as="h2" style={{ fontSize: 16, marginTop: 24 }}>Project Performance</Heading>
          {projects.map(p => (
            <Section key={p.code} style={{ borderBottom: '1px solid #eee', padding: '8px 0' }}>
              <Row>
                <Column>
                  <Text style={{ color: '#FF5500', fontWeight: 'bold', fontFamily: 'monospace', margin: 0 }}>{p.code}</Text>
                  <Text style={{ fontSize: 14, margin: 0 }}>{p.name}</Text>
                </Column>
                <Column align="right">
                  <Text style={{ fontFamily: 'monospace', fontSize: 12, margin: 0 }}>
                    SPI <strong>{p.spi ? p.spi.toFixed(2) : '—'}</strong>
                  </Text>
                  <Text style={{ fontFamily: 'monospace', fontSize: 12, margin: 0 }}>{p.progressPct.toFixed(1)}%</Text>
                </Column>
              </Row>
            </Section>
          ))}

          <Hr style={{ borderColor: '#eee', margin: '32px 0 16px' }} />
          <Text style={{ color: '#888', fontSize: 11, fontFamily: 'monospace' }}>
            View full portfolio dashboard in app · SITELOG
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderWeeklyDigest(props: Props): Promise<string> {
  return render(<WeeklyDigestEmail {...props} />);
}
