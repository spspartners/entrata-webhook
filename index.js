const express = require("express");
const fetch = require("node-fetch");
const app = express();
app.use(express.json());

// Make createdDate safely in the past so it can NEVER be > current time
function toEntrataTimestamp() {
  const date = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
  const pad = n => String(n).padStart(2, "0");
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const yyyy = date.getFullYear();
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${mm}/${dd}/${yyyy}T${hh}:${mi}:${ss}`;
}

// Optional: normalize move-in date to MM/DD/YYYY
function toMMDDYYYY(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())}/${d.getFullYear()}`;
}

app.post("/", async (req, res) => {
  try {
    const { firstName, lastName, email, phone, moveInDate, notes } = req.body;

    // Property ID for The Ave Apartments
    const propertyId = 100016881;

    const payload = {
      auth: { type: "apikey" }, // using /ext/orgs gateway (API key goes in header)
      requestId: "1",
      method: {
        name: "sendLeads",
        version: "r1",
        params: {
          propertyId,
          doNotSendConfirmationEmail: "1",
          isWaitList: "0",
          prospects: {
            prospect: {
              createdDate: toEntrataTimestamp(),
              customers: {
                customer: {
                  name: { firstName, lastName },
                  phone: { cellPhoneNumber: phone }, // personalPhoneNumber also works if you prefer
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

    const entrataUrl = `https://apis.entrata.com/ext/orgs/spspartners/v1/leads`;

    const response = await fetch(entrataUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.ENTRATA_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    console.log("Entrata response:", text);

    // Try to return JSON if possible, else pass raw text
    try { return res.status(response.ok ? 200 : 502).json(JSON.parse(text)); }
    catch { return res.status(response.ok ? 200 : 502).send(text); }

  } catch (error) {
    console.error("Error sending lead to Entrata:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get("/", (_req, res) => res.send("OK"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Webhook listening on ${port}`));
