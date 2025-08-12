// index.js
const express = require("express");
const app = express();

app.use(express.json());

// Health
app.get("/", (_req, res) => res.send("OK"));

// Format date to MM/DD/YYYY if you pass ISO (optional helper)
function toMMDDYYYY(d) {
  if (!d) return "";
  // Accept "YYYY-MM-DD", "MM/DD/YYYY", or "dd.mm.yyyy"
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/;
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const dot = /^(\d{2})\.(\d{2})\.(\d{4})$/;

  if (iso.test(d)) {
    const [, y, m, day] = d.match(iso);
    return `${m}/${day}/${y}`;
  }
  if (slash.test(d)) return d;
  if (dot.test(d)) {
    const [, dd, mm, yyyy] = d.match(dot);
    return `${mm}/${dd}/${yyyy}`;
  }
  return `${d}`; // fallback—Entrata will validate
}

// Shared lead handler
async function handleLead(req, res) {
  try {
    const ORG = process.env.ENTRATA_ORG;
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

    const pid = propertyId || req.query.propertyId || req.params?.propertyId;

    const missing = ["firstName", "lastName", "email", "phone", "propertyId"]
      .filter(k => !(k === "propertyId" ? pid : req.body[k]));
    if (missing.length) {
      return res.status(400).send(`Missing: ${missing.join(", ")}`);
    }

    const entrataUrl = `https://${ORG}.entrata.com/api/v1/leads`;

    // Minimal valid sendLeads payload (no bedrooms/bathrooms)
    const payload = {
      auth: { type: "apikey", key: API_KEY },
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
      headers: { "Content-Type": "application/json" },
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

// Debug echo
app.post("/debug", (req, res) => {
  console.log("🛠 Sleeknote sent this payload:");
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).send({ message: "Received payload", receivedData: req.body });
});

// Routes
app.post("/", handleLead);               // propertyId in body or ?propertyId=
app.post("/p/:propertyId", handleLead);  // or /p/100016881

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Webhook listening on ${port}`));
