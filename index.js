// index.js
const express = require("express");
const app = express();

app.use(express.json());

// --- Health ---
app.get("/", (_req, res) => res.send("OK"));

// --- Helpers ---
function toMMDDYYYY(d) {
  if (!d) return "";
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/;           // 2025-09-15
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/;       // 09/15/2025
  const dot = /^(\d{2})\.(\d{2})\.(\d{4})$/;         // 15.09.2025
  if (iso.test(d)) { const [, y, m, day] = d.match(iso); return `${m}/${day}/${y}`; }
  if (slash.test(d)) return d;
  if (dot.test(d))  { const [, dd, mm, yyyy] = d.match(dot); return `${mm}/${dd}/${yyyy}`; }
  return `${d}`;
}

// Entrata requires "MM/DD/YYYYTHH:MM:SS"
function toEntrataTimestamp(date = new Date()) {
  const pad = n => String(n).padStart(2, "0");
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const yyyy = date.getFullYear();
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${mm}/${dd}/${yyyy}T${hh}:${mi}:${ss}`;
}

/**
 * Decide Entrata endpoint + headers + auth block based on env.
 * Supports:
 *  - API Key gateway (/ext/orgs/{org}) with header X-Api-Key
 *  - Basic auth on org URL ({org}.entrata.com) with Authorization: Basic
 */
function buildEntrataRequestPieces() {
  const ORG = process.env.ENTRATA_ORG;
  if (!ORG) throw new Error("Missing ENTRATA_ORG");

  const apiKey = process.env.ENTRATA_API_KEY;
  const user   = process.env.ENTRATA_USERNAME;
  const pass   = process.env.ENTRATA_PASSWORD;

  if (apiKey) {
    const url = `https://apis.entrata.com/ext/orgs/${ORG}/v1/leads`;
    const headers = {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey
    };
    // /ext/orgs expects an auth block with just the type
    const authBlock = { type: "apikey" };
    return { url, headers, authBlock };
  }

  if (user && pass) {
    const url = `https://${ORG}.entrata.com/api/v1/leads`;
    const basic = Buffer.from(`${user}:${pass}`).toString("base64");
    const headers = {
      "Content-Type": "application/json",
      "Authorization": `Basic ${basic}`
    };
    // Some tenants also accept basic credentials in body:
    const authBlock = { type: "basic", username: user, password: pass };
    return { url, headers, authBlock };
  }

  throw new Error("No Entrata credentials found. Set ENTRATA_API_KEY or ENTRATA_USERNAME/ENTRATA_PASSWORD.");
}

// --- Lead handler ---
async function handleLead(req, res) {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      notes,
      moveInDate,
      propertyId
    } = req.body;

    const pid = propertyId || req.query.propertyId || req.params?.propertyId;

    const missing = ["firstName","lastName","email","phone","propertyId"]
      .filter(k => !(k === "propertyId" ? pid : req.body[k]));
    if (missing.length) return res.status(400).send(`Missing: ${missing.join(", ")}`);

    const { url, headers, authBlock } = buildEntrataRequestPieces();

    // Minimal, valid sendLeads payload with createdDate + customerPreferences
    const payload = {
      auth: authBlock,
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
              createdDate: toEntrataTimestamp(), // <-- required timestamp
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

    const r = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });

    const text = await r.text();
    console.log("Entrata response:", text);

    if (!r.ok) return res.status(502).send(text || "Entrata rejected the lead");
    return res.status(200).send(text || "Lead sent to Entrata successfully");
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).send("Failed to send lead");
  }
}

// --- Debug endpoint ---
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

