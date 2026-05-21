import { Html, Head, Body, Container, Heading, Text, Button, Hr, render } from '@react-email/components';

interface Props {
  orgName: string;
  inviterName: string;
  acceptUrl: string;
}

export function InviteEmail({ orgName, inviterName, acceptUrl }: Props) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: '-apple-system, sans-serif', backgroundColor: '#FAFAF7' }}>
        <Container style={{ maxWidth: 560, margin: '40px auto', padding: 24, backgroundColor: 'white', border: '2px solid #0A0A0A' }}>
          <Text style={{ color: '#FF5500', fontFamily: 'monospace', letterSpacing: 2, fontSize: 11, margin: 0 }}>SITELOG · INVITATION</Text>
          <Heading style={{ fontSize: 28, marginTop: 16, marginBottom: 16 }}>You've been invited</Heading>
          <Text>
            <strong>{inviterName}</strong> invited you to join <strong>{orgName}</strong> on Sitelog.
          </Text>
          <Button href={acceptUrl} style={{
            display: 'inline-block', backgroundColor: '#FF5500', color: 'white',
            padding: '14px 24px', textDecoration: 'none', fontFamily: 'monospace',
            letterSpacing: 1, fontWeight: 'bold', margin: '24px 0',
          }}>
            ACCEPT INVITATION →
          </Button>
          <Text style={{ color: '#888', fontSize: 13 }}>
            Or copy this link: <a href={acceptUrl}>{acceptUrl}</a>
          </Text>
          <Hr style={{ borderColor: '#eee', margin: '32px 0 16px' }} />
          <Text style={{ color: '#888', fontSize: 12, fontFamily: 'monospace' }}>
            SITELOG · construction SaaS
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderInvite(props: Props): Promise<string> {
  return render(<InviteEmail {...props} />);
}
