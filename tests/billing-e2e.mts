/** Billing: server-computed prices come from adminSettings/global.plans (the admin console's source of truth). */
import express from "express";
import axios from "axios";
import billingRouter from "../server/routes/billing";
import { dbAdmin } from "../server/firebaseAdmin";
import { clearPlanCache } from "../server/utils/plans";

let pass = 0, failed = 0;
const check = (name: string, cond: boolean, extra = "") => { cond ? pass++ : failed++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : "  <- " + extra}`); };
process.env.VITE_PAYPAL_CLIENT_ID = "cid"; process.env.PAYPAL_SECRET_KEY = "sec";

// Same shape and prices as production (checked against the live adminSettings document).
await dbAdmin.collection("adminSettings").doc("global").set({
  plans: [
    { id: "free", price: 0, trialDays: 0, trialEnabled: false, features: [] },
    { id: "pro", price: 19, annualPrice: 180, extraSeatCost: 12, trialDays: 14, trialEnabled: true, features: ["kioskMode"] },
    { id: "enterprise", price: "49", annualPrice: "490", extraSeatCost: "9", trialDays: 14, trialEnabled: true, features: ["kioskMode"] },
  ],
});

// Stub PayPal at the axios adapter level; record what the server asks PayPal to charge.
let charged: any = null; let captureAmount = "";
(axios.defaults as any).adapter = async (config: any) => {
  const url = String(config.url); const ok = (data: any) => ({ data, status: 200, statusText: "OK", headers: {}, config });
  if (url.includes("/oauth2/token")) return ok({ access_token: "tok" });
  if (url.endsWith("/v2/checkout/orders")) { charged = JSON.parse(config.data).purchase_units[0].amount; return ok({ id: "ORDER12345", status: "CREATED" }); }
  if (url.includes("/capture")) return ok({ id: "ORDER12345", status: "COMPLETED", purchase_units: [{ payments: { captures: [{ status: "COMPLETED", amount: { currency_code: "USD", value: captureAmount } }] } }] });
  throw new Error("unexpected axios call " + url);
};

const app = express(); app.use(express.json()); app.use(billingRouter);
const srv = app.listen(0); const base = `http://localhost:${(srv.address() as any).port}`;
const AUTH = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1`;
const su: any = await (await fetch(`${AUTH}/accounts:signUp?key=x`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "pay@own.dev", password: "pw123456", returnSecureToken: true }) })).json();
await dbAdmin.collection("users").doc(su.localId).set({ uid: su.localId, email: "pay@own.dev", plan: "free" });
const post = async (path: string, body: any) => { const r = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${su.idToken}` }, body: JSON.stringify(body) }); return { status: r.status, data: await r.json() as any }; };
const price = async (body: any) => { clearPlanCache(); charged = null; const r = await post("/api/paypal/create-order", body); return { r, amount: charged?.value }; };

check("Pro monthly = $19", (await price({ planId: "pro" })).amount === "19.00");
check("Pro annual = $180", (await price({ planId: "pro", billingCycle: "annual" })).amount === "180.00");
check("Pro + 2 seats monthly = 19 + 2x12 = $43", (await price({ planId: "pro", extraSeats: 2 })).amount === "43.00");
check("Enterprise monthly = $49 (not the old $99 default)", (await price({ planId: "enterprise" })).amount === "49.00");
check("Enterprise annual + 3 seats = 490 + 3x9x12 = $814", (await price({ planId: "enterprise", billingCycle: "annual", extraSeats: 3 })).amount === "814.00");
const spoof = await price({ planId: "enterprise", amount: 1, currency: "EUR" });
check("client-supplied amount/currency are ignored", spoof.amount === "49.00" && charged.currency_code === "USD");
check("free / unknown plans cannot be bought", (await price({ planId: "free" })).r.status === 400 && (await price({ planId: "nope" })).r.status === 400);
check("absurd seat count is capped", (await price({ planId: "pro", extraSeats: 999999 })).amount === "6019.00"); // 19 + 500 x 12

// capture: plan/amount come from the stored order, never from the request
await price({ planId: "enterprise", extraSeats: 1 });
captureAmount = "1.00";
const bad = await post("/api/paypal/capture-order", { orderID: "ORDER12345", planId: "enterprise" });
check("capture with the wrong paid amount is refused and grants nothing", bad.status === 400 && (await dbAdmin.collection("users").doc(su.localId).get()).data()?.plan === "free", JSON.stringify(bad));
await price({ planId: "enterprise", extraSeats: 1 });
captureAmount = "58.00";
const good = await post("/api/paypal/capture-order", { orderID: "ORDER12345", planId: "free", extraSeats: 0 });
const u = (await dbAdmin.collection("users").doc(su.localId).get()).data();
check("correct payment upgrades using the STORED plan and seats", good.status === 200 && u?.plan === "enterprise" && u?.extraSeats === 1, JSON.stringify(u));
check("the same order cannot be captured twice", (await post("/api/paypal/capture-order", { orderID: "ORDER12345" })).status === 409);

const trial = await post("/api/billing/activate-trial", { planId: "pro", trialDays: 9999 });
const tu = (await dbAdmin.collection("users").doc(su.localId).get()).data();
const days = Math.round((Date.parse(tu?.trialEndDate) - Date.now()) / 86400000);
check("trial length comes from the plan (14 days), not the client's 9999", trial.status === 200 && days === 14, `status=${trial.status} days=${days}`);

console.log(`\n${pass} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
