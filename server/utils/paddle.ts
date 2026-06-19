import express from "express";
import crypto from "crypto";

export function verifyPaddleSignature(req: express.Request, rawBody: string, secret: string): boolean {
  const signatureHeader = req.headers['paddle-signature'] as string || '';
  if (!signatureHeader) return false;

  const parts = signatureHeader.split(';');
  let ts = '';
  let h1 = '';
  for (const part of parts) {
    const [key, val] = part.split('=');
    if (key === 'ts') ts = val;
    if (key === 'h1') h1 = val;
  }

  if (!ts || !h1) return false;

  const message = `${ts}:${rawBody}`;
  const computedHash = crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest('hex');

  try {
    return crypto.timingSafeEqual(
      Buffer.from(computedHash, 'hex'),
      Buffer.from(h1, 'hex')
    );
  } catch {
    return false;
  }
}
