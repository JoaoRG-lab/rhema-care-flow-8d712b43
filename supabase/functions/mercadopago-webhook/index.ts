import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-signature, x-request-id",
};

async function verifyMercadoPagoSignature(req: Request, paymentId: string, secret: string): Promise<boolean> {
  const signature = req.headers.get("x-signature") ?? "";
  const requestId = req.headers.get("x-request-id") ?? "";
  const ts = signature.match(/(?:^|,)\s*ts=([^,]+)/)?.[1];
  const v1 = signature.match(/(?:^|,)\s*v1=([^,]+)/)?.[1];
  if (!requestId || !ts || !v1) return false;

  const manifest = `id:${paymentId};request-id:${requestId};ts:${ts};`;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(manifest));
  const expected = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return expected === v1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const MP_TOKEN = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    const MP_WEBHOOK_SECRET = Deno.env.get("MERCADOPAGO_WEBHOOK_SECRET");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!MP_TOKEN) throw new Error("MERCADOPAGO_ACCESS_TOKEN not configured");
    if (!MP_WEBHOOK_SECRET) throw new Error("MERCADOPAGO_WEBHOOK_SECRET not configured");

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    const body = await req.json().catch(() => ({}));
    const url = new URL(req.url);
    // Mercado Pago sends { type: 'payment', data: { id } } OR query params (?topic=payment&id=...)
    const paymentId =
      body?.data?.id ||
      body?.resource?.toString().split("/").pop() ||
      url.searchParams.get("id") ||
      url.searchParams.get("data.id");

    const topic = body?.type || body?.topic || url.searchParams.get("topic") || url.searchParams.get("type");

    if (!paymentId || (topic && topic !== "payment")) {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!(await verifyMercadoPagoSignature(req, String(paymentId), MP_WEBHOOK_SECRET))) {
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch payment details from MP
    const mpResp = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${MP_TOKEN}` },
    });
    const payment = await mpResp.json();
    if (!mpResp.ok) {
      console.error("MP fetch error:", payment);
      return new Response(JSON.stringify({ error: "MP fetch failed" }), {
        status: 200, // ack so MP doesn't retry forever
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const externalId = String(payment.id);
    const status = payment.status as string; // approved, pending, rejected, cancelled

    // Find local transaction
    const { data: tx, error: txError } = await supabase
      .from("payment_transactions")
      .select("*")
      .eq("external_id", externalId)
      .maybeSingle();

    if (txError) console.error("tx lookup error:", txError);
    if (!tx) {
      console.warn("Transaction not found for external_id", externalId);
      return new Response(JSON.stringify({ ok: true, notFound: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Idempotency: only credit once when going from non-paid to approved
    if (status === "approved" && tx.status !== "paid") {
      // Upsert credits row
      const { data: creditRow } = await supabase
        .from("user_ai_credits")
        .select("*")
        .eq("user_id", tx.user_id)
        .maybeSingle();

      if (creditRow) {
        await supabase
          .from("user_ai_credits")
          .update({ credits_balance: creditRow.credits_balance + tx.credits_amount })
          .eq("user_id", tx.user_id);
      } else {
        await supabase.from("user_ai_credits").insert({
          user_id: tx.user_id,
          credits_balance: tx.credits_amount,
        });
      }

      await supabase
        .from("payment_transactions")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", tx.id);
    } else if (status === "rejected" || status === "cancelled") {
      await supabase
        .from("payment_transactions")
        .update({ status: status })
        .eq("id", tx.id);
    }

    return new Response(JSON.stringify({ ok: true, status }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("mercadopago-webhook error:", error);
    // Return 200 so MP doesn't keep retrying on bugs
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
