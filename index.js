const express = require("express");
const fetch = require("node-fetch");
const app = express();
app.use(express.json());

// shared handler
async function handleLead(req, res) {
  try {
    const {
      firstName, lastName, email, phone, notes,
      moveInDate, bedrooms, bathrooms, unitType
    } = req.body;

    // accept propertyId from body, ?propertyId=, or /p/:propertyId
    const propertyId = req.body.propertyId || req.query.propertyId || req.params?.propertyId;

    // basic validation
    const missing = ["firstName","lastName","email","phone","propertyId"]
      .filter(k => !(k === "propertyId" ? propertyId : req.body[k]));
    if (missing.length) return res.status(400).send(`Missing: ${missing.join(", ")}`);

    const leadData = {
      firstName, lastName, email, phone, propertyId,
      notes: notes || undefined,
      moveInDate: moveInDate || undefined,
      bedrooms: bedrooms || undefined,
      bathrooms: bathrooms || undefined,
      unitType: unitType || undefined
    };

    const url = `${process.env.ENTRATA_BASE_URL}/leads`;
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.ENTRATA_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(leadData)
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("Entrata error:", text);
      return res.status(502).send(text);
    }

    res.status(200).send("Lead sent to Entrata successfully");
  } catch (e) {
    console.error(e);
    res.status(500).send("Failed to send lead");
  }
}

// health
app.get("/", (_req, res) => res.send("OK"));

// Accept POSTs three ways:
app.post("/", handleLead);               // body or ?propertyId=123
app.post("/p/:propertyId", handleLead);  // path /p/123

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Webhook listening on ${port}`));
