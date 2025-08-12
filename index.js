// index.js
const express = require("express");
const app = express();

// Parse JSON bodies
app.use(express.json());

// --- Health check ---
app.get("/", (_req, res) => res.send("OK"));

// --- Shared lead handler ---
async function handleLead(req, res) {
  try {
    const {
      firstName, lastName, email, phone, notes,
      moveInDate, bedrooms, bathrooms, unitType
    } = req.body;

    // Accept propertyId from body, ?propertyId=, or /p/:propertyId
    const propertyId =
      req.body.propertyId || req.query.propertyId || req.params?.propertyId;

    // Basic validation
    const missing = ["firstName","lastName","email","phone","propertyId"]
      .filter(k => !(k === "propertyId" ? propertyId : req.body[k]));
    if (missing.length) {
      return res.status(400).send(`Missing: ${missing.join(", ")}`);
    }

    // Format payload for Entrata
    const leadData = {
      firstName, lastName, email, phone, propertyId,
      notes: notes || undefined,
      moveInDate: moveInDate || undefined,
      bedrooms: bedrooms || undefined,
      bathrooms: bathrooms || undefined,
      unitType: unitType || undefined
    };

    // POST to Entrata Lead endpoint
    const url = `${process.env.ENTRATA_BASE_URL}/leads`; // e.g. https://apis.entrata.com/ext/leads
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.ENTRATA_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(leadData)
    });

    const text = await resp.text(); // keep as text for easier debugging
    if (!resp.ok) {
      console.error("Entrata error:", text);
      return res.status(502).send(text || "Entrata rejected the lead");
    }

    return res.status(200).send(text || "Lead sent to Entrata successfully");
  } catch (err) {
    console.error("Handler error:", err);
    return res.status(500).send("Failed to send lead");
  }
}

// --- Routes ---
// Debug echo (use first to confirm Sleeknote payload)
app.post("/debug", (req, res) => {
  console.log("🛠 Sleeknote sent this payload:");
  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).send({ message: "Received payload", receivedData: req.body });
});

// Production endpoints
app.post("/", handleLead);               // body or ?propertyId=123
app.post("/p/:propertyId", handleLead);  // path /p/123

// --- Server ---
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Webhook listening on ${port}`));
