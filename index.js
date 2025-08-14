// index.js (CommonJS)
const express = require("express");
const app = express();
app.use(express.json());

// ── Config via environment (set these in Render dashboard) ─────────────
const ENTRATA_ORG        = process.env.ENTRATA_ORG || "spspartners";
const ENTRATA_USERNAME   = process.env.ENTRATA_USERNAME; // required
const ENTRATA_PASSWORD   = process.env.ENTRATA_PASSWORD; // required
const DEFAULT_PROPERTY_ID= process.env.DEFAULT_PROPERTY_ID || "100016881";
const DEFAULT_SOURCE     = process.env.DEFAULT_SOURCE || "Sleeknote Popup";

// ── Helpers ────────────────────────────────────────────────────────────
const pick = (...xs) => {
  for (const v of xs) if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
  return undefined;
};
const toIntOrDefault = (v, d) => (Number.isFinite(parseInt(v,10)) ? parseInt(v,10) : parseInt(d,10));
const toOptInFlag = (v) => {
  if (v === undefined || v === null) return "0";
  const s = String(v).toLowerCase().trim();
  return (["1","true","yes","y","on","checked"].includes(s) ? "1" : "0");
};
const safeCreatedDateISO = () => new Date(Date.now() - 60*1000).toISOString(); // 1 min in past

// ── Debug endpoint ─────────────────────────────────────────────────────
app.post("/debug", (req, res) => {
  console.log("🛠 /debug payload:\n", JSON.stringify(req.body, null, 2));
  res.json({ ok: true, received: req.body });
});

// ── Main endpoint for Sleeknote ───────────────────────────────────────
app.post("/", async (req, res) => {
  const raw = req.body || {};
  console.log("📩 Incoming body:\n", JSON.stringify(raw, null, 2));

  const firstName    = pick(raw.firstName, raw.firstname, raw["First Name"]);
  const lastName     = pick(raw.lastName, raw.lastname, raw["Last Name"]);
  const email        = pick(raw.email, raw["Email"]);
  const phone        = pick(raw.phone, raw.phoneNumber, raw["Phone"]);
  const moveInDate   = pick(raw.moveInDate, raw["Move In Date"]); // optional (MM/DD/YYYY ideal)
  const notes        = pick(raw.notes, raw.message, raw["Message"]); // optional
  const smsOptInFlag = toOptInFlag(pick(raw.smsOptIn, raw.SMS, raw.sms, raw.smsConsent, raw.sms_opt_in));
  const marketingSource = pick(raw.marketingSource, raw.source, DEFAULT_SOURCE);

  const propertyId = pick(raw.propertyId, req.query.propertyId, DEFAULT_PROPERTY_ID);
  const propIdInt  = toIntOrDefault(propertyId, DEFAULT_PROPERTY_ID);
  const createdDate = safeCreatedDateISO();

  const payload = {
    auth: { type: "basic", username: ENTRATA_USERNAME, password: ENTRATA_PASSWORD },
    requestId: "1",
    method: {
      name: "sendLeads",
      params: {
        propertyId: propIdInt,
        doNotSendConfirmationEmail: "0",
        isWaitList: "0",
        prospects: {
          prospect: {
            leadSource: {
              // If you later get a numeric source ID, switch to originatingLeadSourceId
              leadSourceName: marketingSource
            },
            createdDate,
            customers: {
              customer: {
                name: {
                  firstName: firstName || "NoFirstName",
                  lastName:  lastName  || "NoLastName"
                },
                phone: { personalPhoneNumber: phone || "000-000-0000" },
                email: email || "noemail@example.com",
                marketingPreferences: { optInphone: smsOptInFlag } // "1" or "0"
              }
            },
            customerPreferences: {
              desiredMoveInDate: moveInDate || undefined,
              comment: notes || ""
            }
          }
        }
      }
    }
  };

  console.log("🚀 Outbound to Entrata:", JSON.stringify(payload, null, 2));

  try {
    const url = `https://apis.entrata.com/ext/orgs/${ENTRATA_ORG}/v1/leads`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await r.text();
    console.log("📬 Entrata response:", text);
    try { return res.status(200).json({ ok: true, data: JSON.parse(text) }); }
    catch { return res.status(200).send(text); }
  } catch (e) {
    console.error("❌ Entrata call failed:", e);
    return res.status(500).json({ ok: false, error: e.message });
  }
});

// ── Health route and server start ──────────────────────────────────────
app.get("/", (_req, res) => res.send("OK"));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Webhook listening on ${PORT}`));
