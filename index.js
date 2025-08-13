// index.js (CommonJS)

const express = require("express");
const fetch = require("node-fetch");

const app = express();
app.use(express.json());

// ────────────────────────────────────────────────────────────
// CONFIG: set these for your account
// ────────────────────────────────────────────────────────────
const ENTRATA_ORG = "spspartners";                       // your subdomain
const ENTRATA_USERNAME = "sps_internal_api_4492@spspartners"; // API user name
const ENTRATA_PASSWORD = "YOUR_PASSWORD_HERE";           // API user password
const DEFAULT_PROPERTY_ID = "100016881";                 // The Ave
const DEFAULT_SOURCE = "Sleeknote Popup";                // default marketing source

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────
function pick(...candidates) {
  for (const v of candidates) if (v !== undefined && v !== null && `${v}`.trim() !== "") return `${v}`.trim();
  return undefined;
}

function toIntOrDefault(val, dflt) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : parseInt(dflt, 10);
}

// Convert many truthy representations to Entrata's "1"/"0"
function toOptInFlag(val) {
  if (val === undefined || val === null) return "0";
  const s = String(val).toLowerCase().trim();
  return (s === "1" || s === "true" || s === "yes" || s === "y" || s === "on" || s === "checked") ? "1" : "0";
}

// ISO a minute in the past to be safe vs server clock skew
function safeCreatedDateISO() {
  const dt = new Date(Date.now() - 60 * 1000);
  return dt.toISOString();
}

// ────────────────────────────────────────────────────────────
// Debug endpoint: shows exactly what Sleeknote posts
// ────────────────────────────────────────────────────────────
app.post("/debug", (req, res) => {
  console.log("🛠 Sleeknote sent this payload:\n", JSON.stringify(req.body, null, 2));
  res.json({ ok: true, received: req.body });
});

// ────────────────────────────────────────────────────────────
// Main lead intake
// ────────────────────────────────────────────────────────────
app.post("/", async (req, res) => {
  const raw = req.body || {};
  console.log("📩 Incoming lead body:\n", JSON.stringify(raw, null, 2));

  // Accept multiple possible keys from Sleeknote
  const firstName = pick(raw.firstName, raw.firstname, raw["First Name"]);
  const lastName  = pick(raw.lastName, raw.lastname, raw["Last Name"]);
  const email     = pick(raw.email, raw["Email"]);
  const phone     = pick(raw.phone, raw.phoneNumber, raw["Phone"]);
  const moveInDate= pick(raw.moveInDate, raw["Move In Date"]);  // optional
  const notes     = pick(raw.notes, raw.message, raw["Message"]); // optional

  // New fields you asked for:
  const smsOptInFlag = toOptInFlag(pick(raw.smsOptIn, raw.SMS, raw.sms, raw.smsConsent, raw.sms_opt_in));
  const marketingSource = pick(raw.marketingSource, raw.source, DEFAULT_SOURCE);

  // Property from body, query, or default to The Ave
  const propertyId = pick(raw.propertyId, req.query.propertyId, DEFAULT_PROPERTY_ID);
  const finalPropertyIdInt = toIntOrDefault(propertyId, DEFAULT_PROPERTY_ID);

  // Make createdDate safe (slightly in the past)
  const createdDate = safeCreatedDateISO();

  // Build Entrata sendLeads payload (matches the schema that already worked)
  const payload = {
    auth: {
      type: "basic",
      username: ENTRATA_USERNAME,
      password: ENTRATA_PASSWORD
    },
    requestId: "1",
    method: {
      name: "sendLeads",
      params: {
        propertyId: finalPropertyIdInt,
        doNotSendConfirmationEmail: "0",
        isWaitList: "0",
        prospects: {
          prospect: {
            leadSource: {
              // You can switch to originatingLeadSourceId if you have a numeric ID:
              // originatingLeadSourceId: 123,
              leadSourceName: marketingSource || DEFAULT_SOURCE
            },
            createdDate, // ISO; Entrata accepts ISO here
            customers: {
              customer: {
                name: {
                  firstName: firstName || "NoFirstName",
                  lastName:  lastName  || "NoLastName"
                },
                phone: {
                  personalPhoneNumber: phone || "000-000-0000"
                },
                email: email || "noemail@example.com",
                marketingPreferences: {
                  // This is the closest flag in the Entrata schema for SMS consent
                  optInphone: smsOptInFlag
                }
              }
            },
            customerPreferences: {
              // Entrata usually wants MM/DD/YYYY here; if you can format the
              // Sleeknote date as that string, great. Otherwise we fall back.
              desiredMoveInDate: moveInDate || undefined,
              comment: notes || ""
            }
          }
        }
      }
    }
  };

  console.log("🚀 Sending to Entrata:", JSON.stringify(payload, null, 2));

  try {
    const url = `https://apis.entrata.com/ext/orgs/${ENTRATA_ORG}/v1/leads`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await resp.text(); // log raw for full visibility
    console.log("📬 Entrata response:", text);

    // Try to return JSON if possible, else raw text
    try {
      return res.status(200).json({ ok: true, data: JSON.parse(text) });
    } catch {
      return res.status(200).send(text);
    }
  } catch (err) {
    console.error("❌ Error sending to Entrata:", err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Health
app.get("/", (_req, res) => res.send("OK"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Webhook listening on ${PORT}`));
