// index.js
const express = require("express");
const app = express();

app.use(express.json());

// --- Health ---
app.get("/", (_req, res) => res.send("OK"));

// Optional: normalize move-in date to MM/DD/YYYY
function toMMDDYYYY(d) {
  if (!d) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/;           // 2025-09-15
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/;       // 09/15/2025
  const dot = /^(\d{2})\.(\d{2})\.(\d{4})$/;         // 15.09.2025
  if (iso.test(d)) {
    const [, y, m, day] = d.match(iso);
    return `${m}/${day}/${y}`;
  }
  if (slash.test(d)) return d;
  if (dot.test(d)) {
    const [, dd, mm, yyyy] = d.match(dot);
    return `${mm}/${dd}/${yyyy}`;
  }
  return `${d}`;
}

// --- Shared lead handler (Sleeknote -> Entrata) ---
async function handleLead(req, res) {
  try {
    const ORG = process.env.ENTRATA_ORG;        // e.g. "spspartners"
    const API_KEY = process.env.ENTRATA_API_KEY;
    if (!ORG || !API_KEY) {
      console.error("Missing ENTRATA_ORG or ENTRATA_API_KEY");
      return res.status(500).send("Server misconfigured.");
    }

    const {
      firstName,
      lastName,
      email,
      phone,
      notes,
      moveInDate,
      propertyId
    } = req.body;

    // Accept propertyId from body, query, or path
    const pid = propertyId || req.query.propertyId || req.params?.propertyId;

    // Basic validation
    const missing = ["firstName","lastName","email","phone","propertyId"]
      .filter(k => !(k === "propertyId" ? pid : req.body[k]));
    if (missing.length) return res.status(400).send(`Missing: ${missing.join(", ")}`);

    // ---- Entrata /ext/orgs gateway URL (key in header) ----
    const entrataUrl = `https://apis.entrata.com/ext/orgs/${ORG}/v1/leads`;

    // ---- Minimal, valid sendLeads payload ----
    const payload = {
      auth: { type: "apikey" }, // key is sent in header, not here
      requestId: "1",
      method: {
        name: "sendLeads",
        version: "r1",
        params: {
          propertyId: parseInt(pid, 10),
          doNotSendConfirmationEmail: "1",
          isWaitList: "0",
          prospects: {
            prospect: {
              customers: {
                customer: {
                  name: { firstName, lastName },
                  phone: { personalPhoneNumber: phone },
                  email
                }
              },
              customerPreferences: {
                desiredMoveInDate: toMMDDYYYY(moveInDate) || "",
                comment: notes || ""
              }
            }
          }
        }
      }
    };

    const resp = await fetch(entrataUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": API_KEY // <-- required by Entrata gateway
      },
      body: JSON.stringify(payload)
    });

    const text = await resp.text();
    console.log("Entrata response:", text);

    if (!resp.ok) return res.status(502).send(text || "Entrata rejected the lead");
    return res.status(200).send(text || "Lead sent to Entrata successfully");
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).send("Failed to send lead");
  }
}

// --- Debug endpoint to inspect Sleeknote payloads ---
app.post("/debug", (req, res) => {
  console.log("🛠 Sleeknote sent this payload:");
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).send({ message: "Received payload", receivedData: req.body });
});

// --- Routes ---
app.post("/", handleLead);               // propertyId in body or ?propertyId=
app.post("/p/:propertyId", handleLead);  // or /p/100016881

// --- Server ---
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Webhook listening on ${port}`));
