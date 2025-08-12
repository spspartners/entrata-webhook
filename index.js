// index.js
const express = require("express");
const app = express();

app.use(express.json());

// --- Health check ---
app.get("/", (_req, res) => res.send("OK"));

// --- Shared lead handler ---
async function handleLead(req, res) {
  try {
    const {
      firstName,
      lastName,
      email,
      phone,
      notes,
      moveInDate,
      bedrooms,
      bathrooms,
      unitType,
      propertyId
    } = req.body;

    // Basic validation
    const pid = propertyId || req.params?.propertyId || req.query?.propertyId;
    const missing = ["firstName","lastName","email","phone","propertyId"]
      .filter(k => !(k === "propertyId" ? pid : req.body[k]));
    if (missing.length) {
      return res.status(400).send(`Missing: ${missing.join(", ")}`);
    }

    // ----- Build Entrata payload (createLead) -----
    const entrataUrl = `https://${process.env.ENTRATA_ORG}.entrata.com/api/v1/leads`;

    const payload = {
      auth: {
        type: "apikey",
        key: process.env.ENTRATA_API_KEY
      },
      requestId: "1",
      method: {
        name: "createLead",   // if your tenant uses a different name, update here
        version: "r1",
        params: {
          propertyId: parseInt(pid, 10),
          name: `${firstName} ${lastName}`,
          telephone: phone,
          email: email,
          // Optional extras if your schema supports them:
          // moveInDate, bedrooms, bathrooms, unitType, notes
        }
      }
    };

    const r = await fetch(entrataUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    const text = await r.text();
    console.log("Entrata response:", text);

    if (!r.ok) {
      return res.status(502).send(text || "Entrata rejected the lead");
    }

    return res.status(200).send(text || "Lead sent to Entrata successfully");
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).send("Failed to send lead");
  }
}

// --- Debug echo (to verify Sleeknote payloads) ---
app.post("/debug", (req, res) => {
  console.log("🛠 Sleeknote sent this payload:");
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).send({ message: "Received payload", receivedData: req.body });
});

// --- Production endpoints ---
app.post("/", handleLead);               // send propertyId in body or ?propertyId=
app.post("/p/:propertyId", handleLead);  // or use path /p/100016881

// --- Server ---
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Webhook listening on ${port}`));
