import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";

const app = express();
app.use(bodyParser.json());

const ENTRATA_USERNAME = "sps_internal_api_4492@spspartners"; // from Entrata API Access
const ENTRATA_PASSWORD = "YOUR_PASSWORD_HERE"; // from Entrata API Access
const DEFAULT_PROPERTY_ID = "100016881"; // The Ave
const DEFAULT_SOURCE = "Sleeknote Popup"; // Will show as lead source in Entrata

// Debug endpoint to test Sleeknote payload mapping
app.post("/debug", (req, res) => {
  console.log("🛠 Sleeknote sent this payload:", req.body);
  res.json({ success: true, received: req.body });
});

// Main lead handler
app.post("/", async (req, res) => {
  console.log("📩 Incoming lead:", req.body);

  const {
    firstName,
    lastName,
    email,
    phone,
    moveInDate,
    notes,
    propertyId,
    source
  } = req.body;

  const finalPropertyId = propertyId || DEFAULT_PROPERTY_ID;
  const finalSource = source || DEFAULT_SOURCE;

  // Format current date/time for createdDate
  const createdDate = new Date().toISOString();

  // Entrata sendLeads payload
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
        propertyId: parseInt(finalPropertyId, 10),
        doNotSendConfirmationEmail: "0",
        isWaitList: "0",
        prospects: {
          prospect: {
            leadSource: {
              leadSourceName: finalSource
            },
            createdDate: createdDate,
            customers: {
              customer: {
                name: {
                  firstName: firstName || "NoFirstName",
                  lastName: lastName || "NoLastName"
                },
                phone: {
                  personalPhoneNumber: phone || "000-000-0000"
                },
                email: email || "noemail@example.com"
              }
            },
            customerPreferences: {
              desiredMoveInDate: moveInDate || createdDate,
              comment: notes || ""
            }
          }
        }
      }
    }
  };

  console.log("🚀 Sending to Entrata:", JSON.stringify(payload, null, 2));

  try {
    const response = await fetch(
      "https://apis.entrata.com/api/v1/leads",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();
    console.log("📬 Entrata response:", data);
    res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error sending to Entrata:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get("/", (req, res) => {
  res.send("OK");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
