#!/usr/bin/env python3
"""
Verify Sitelog webhook signature (Python consumer side).

Sitelog signs outgoing webhooks with HMAC-SHA256 of the JSON payload.
Header: `x-sitelog-signature: <hex>`

Example Flask handler:

    @app.route('/sitelog-webhook', methods=['POST'])
    def sitelog_webhook():
        sig = request.headers.get('x-sitelog-signature', '')
        if not verify_webhook(SECRET, request.data, sig):
            abort(401)
        event = request.get_json()
        process(event)
        return {'received': True}

Run:  python examples/webhook-verify-python.py
"""
import hmac
import hashlib
import json


def verify_webhook(secret: str, body: bytes | str, header_signature: str) -> bool:
    if isinstance(body, str):
        body = body.encode("utf-8")
    expected = hmac.new(secret.encode("utf-8"), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header_signature)


if __name__ == "__main__":
    SECRET = "whsec_demo_test_secret"
    body = json.dumps({
        "event": "entry.submitted",
        "orgId": "org-uuid-here",
        "ts": "2026-05-22T01:00:00Z",
        "data": {"entryId": "entry-uuid", "projectId": "proj-uuid"},
    }, separators=(",", ":"))

    sig = hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).hexdigest()
    print(f"Generated signature: {sig}")
    print(f"Body: {body}")
    print(f"Verify valid:     {verify_webhook(SECRET, body, sig)}")
    print(f"Verify tampered:  {verify_webhook(SECRET, body + 'x', sig)}")
    print(f"Verify wrong key: {verify_webhook('wrong_secret', body, sig)}")
