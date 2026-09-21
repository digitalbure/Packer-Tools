/** Email routes against the Auth emulator, with the Resend HTTP API stubbed. */
import express from "express";
import emailRouter from "../server/routes/email";

let pass = 0, failed = 0;
const check = (name: string, cond: boolean, extra = "") => { cond ? pass++ : failed++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  <- " + extra}`); };

const app = express(); app.use(express.json()); app.set("trust proxy", 1); app.use(emailRouter);
const srv = app.listen(0); const base = `http://localhost:${(srv.address() as any).port}`;
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`;
const signUp: any = await (await fetch(`${AUTH}/accounts:signUp?key=x`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "op@customer.dev", password: "pw123456", returnSecureToken: true }) })).json();
const H = { "content-type": "application/json", authorization: `Bearer ${signUp.idToken}` };

// ---- stub Resend ----
const realFetch = globalThis.fetch;
let resendMode: "ok" | "unverified" = "ok";
let lastResendBody: any = null;
globalThis.fetch = (async (url: any, init?: any) => {
  if (String(url).includes("api.resend.com")) {
    lastResendBody = JSON.parse(init.body);
    return resendMode === "ok"
      ? new Response(JSON.stringify({ id: "re_123" }), { status: 200, headers: { "content-type": "application/json" } })
      : new Response(JSON.stringify({ statusCode: 403, name: "validation_error", message: "The packer.tools domain is not verified." }), { status: 403, headers: { "content-type": "application/json" } });
  }
  return realFetch(url, init);
}) as any;

const receipt = { to: "borrower@x.dev", orderNumber: "REC-1", actionType: "checkout", userName: "Bo", items: [{ name: "<img src=x onerror=alert(1)>Camera", assetTag: "PT-1", qty: 1 }] };
const send = (body: any, headers: any = H) => realFetch(`${base}/api/send-email`, { method: "POST", headers, body: JSON.stringify(body) });

check("receipt without auth -> 401", (await send(receipt, { "content-type": "application/json" })).status === 401);

delete process.env.RESEND_API_KEY; delete process.env.EMAIL_SIMULATE;
let r: any = await (await send(receipt)).json();
check("without a Resend key it reports failure, whatever NODE_ENV is (no fake success)", r.success === false && /not configured/i.test(r.error), JSON.stringify(r));

process.env.RESEND_API_KEY = "re_test_key"; resendMode = "unverified";
r = await (await send(receipt)).json();
check("provider rejection is reported as failure with a domain hint", r.success === false && /not verified/.test(r.error) && /SPF\/DKIM/.test(r.error), JSON.stringify(r));

resendMode = "ok";
r = await (await send(receipt)).json();
check("successful send returns the provider message id", r.success === true && r.simulated === false && r.resendId === "re_123", JSON.stringify(r));
check("From uses the verified platform domain", /kiosk-no-reply@packer\.tools/.test(lastResendBody.from), lastResendBody.from);
check("Reply-To is the signed-in operator", lastResendBody.reply_to === "op@customer.dev" || lastResendBody.replyTo === "op@customer.dev", JSON.stringify(lastResendBody));
check("HTML in item names is escaped in the email body", !lastResendBody.html.includes("<img src=x") && lastResendBody.html.includes("&lt;img"));

// From-header injection via customer-controlled company name
await (await realFetch(`${base}/api/emails/send`, { method: "POST", headers: H, body: JSON.stringify({ to: "x@y.dev", type: "welcome", data: { displayName: "N" }, branding: { companyName: 'Evil" <ceo@bank.com>\r\nBcc: a@b.c' } }) })).json();
check("company name cannot inject into the From header", !/[\r\n]/.test(lastResendBody.from) && (lastResendBody.from.match(/</g) || []).length === 1 && /no-reply@packer\.tools>$/.test(lastResendBody.from), lastResendBody.from);

process.env.EMAIL_SIMULATE = "true"; delete process.env.RESEND_API_KEY;
r = await (await send(receipt)).json();
check("simulation only happens when EMAIL_SIMULATE=true", r.success === true && r.simulated === true);

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
