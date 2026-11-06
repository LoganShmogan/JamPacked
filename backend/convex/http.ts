import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

declare const process: { env: Record<string, string | undefined> }; // Convex functions can read env vars

const http = httpRouter();

/** Stripe's signature check: HMAC-SHA256 of "<t>.<body>" with the endpoint secret, within 5 minutes. */
export async function verifyStripe(body: string, header: string | null, secret: string, now = Date.now()) {
  const parts = (header ?? "").split(",").map((p) => p.split("=") as [string, string]);
  const t = parts.find(([k]) => k === "t")?.[1];
  const sigs = parts.filter(([k]) => k === "v1").map(([, s]) => s);
  if (!t || !sigs.length || !(Math.abs(now / 1000 - Number(t)) <= 300)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)));
  const expected = [...mac].map((b) => b.toString(16).padStart(2, "0")).join("");
  // Constant time, so the signature can't be guessed a character at a time.
  return sigs.some((s) => s.length === expected.length && [...s].reduce((d, c, i) => d | (c.charCodeAt(0) ^ expected.charCodeAt(i)), 0) === 0);
}

// Stripe → Convex. Live at https://app.jampacked.co.nz/http/stripe/webhook (nginx sends /http/ to Convex's
// HTTP actions); add that URL in Stripe → Developers → Webhooks and set STRIPE_WEBHOOK_SECRET.
http.route({
  path: "/stripe/webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return new Response("Webhook not configured", { status: 503 });
    const body = await req.text();
    if (!(await verifyStripe(body, req.headers.get("stripe-signature"), secret))) {
      return new Response("Bad signature", { status: 400 });
    }
    const event = JSON.parse(body);
    await ctx.runMutation(internal.billing.applyEvent, { type: event.type, object: event.data.object, created: event.created });
    return new Response(null, { status: 200 });
  }),
});

export default http;
