const express = require("express");
const fetch = require("node-fetch");
const app = express();
app.use(express.json());

// Helper to match Entrata's timestamp format & avoid future time errors
function toEntrataTimestamp(date = new Date()) {
  date.setMinutes(date.getMinutes() - 1); // 1 minute in the past
  const pad = n => String(n).padStart(2, "0");
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const yyyy = date.getFullYear();
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  return `${mm}/${dd}/${yyyy}T${hh}:${mi}:${ss}`;
}

app.post("/", async (req, res) => {
  try {
    const { firstName, lastName, email, phone } = req.body;

    // Hardcoded property ID for The Ave Apartments
    const propertyId = 100016881;

    const payload = {
      auth: {
        type: "apikey",
        key: process.env.ENTRATA_API_KEY
      },
      requestId: "1",
      method: {
        name: "sendLeads",
        params: {
          propertyId: propertyId,
          doNotSendConfirmationEmail: "1",
          isWaitList: "0",
          prospects: {
            prospect: {
              createdDate: toEntrataTimestamp(),
              customers: {
                customer: {
                  name: {
                    firstName: firstName,
                    lastName: lastName
                  },
                  phone: {
                    cellPhoneNumber: phone
                  },
                  email: email
                }
              }
            }
          }
        }
      }
    };

    const entrataUrl = `https://apis.entrata.com/ext/orgs/spspartners/leads`;

    const response = await fetch(entrataUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": process.env.ENTRATA_API_KEY
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    console.log("Entrata response:", JSON.stringify(data, null, 2));

    res.status(200).json({ success: true, data });

  } catch (error) {
    console.error("Error sending lead to Entrata:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check endpoint
app.get("/", (_req, res) => res.send("OK"));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Webhook listening on ${port}`));
