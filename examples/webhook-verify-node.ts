/**
 * Verify Sitelog webhook signature (Node.js consumer side).
 *
 * Sitelog signs outgoing webhooks with HMAC-SHA256 of the JSON payload.
 * Header: `x-sitelog-signature: <hex>`
 *
 * Run example:
 *   bun examples/webhook-verify-node.ts
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

export function verifyWebhook(secret: string, body: string, headerSignature: string): boolean {
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  const a = Buffer.from(expected, 'hex');
  const b = Buffer.from(headerSignature, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Example Express handler:
//
// app.post('/sitelog-webhook', express.raw({ type: 'application/json' }), (req, res) => {
//   const sig = req.header('x-sitelog-signature');
//   if (!sig || !verifyWebhook(process.env.SITELOG_WEBHOOK_SECRET, req.body.toString(), sig)) {
//     return res.status(401).send('invalid signature');
//   }
//   const event = JSON.parse(req.body.toString());
//   console.log('event:', event.event, 'data:', event.data);
//   res.json({ received: true });
// });

// Demo: round-trip test
const SECRET = 'whsec_demo_test_secret';
const BODY = JSON.stringify({
  event: 'entry.submitted',
  orgId: 'org-uuid-here',
  ts: new Date().toISOString(),
  data: { entryId: 'entry-uuid', projectId: 'proj-uuid' },
});

const sig = createHmac('sha256', SECRET).update(BODY).digest('hex');
console.log('Generated signature:', sig);
console.log('Body:', BODY);
console.log('Verify valid:  ', verifyWebhook(SECRET, BODY, sig));
console.log('Verify tampered:', verifyWebhook(SECRET, BODY + 'x', sig));
console.log('Verify wrong key:', verifyWebhook('wrong_secret', BODY, sig));
