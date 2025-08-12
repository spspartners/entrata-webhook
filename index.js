const entrataUrl = `https://${process.env.ENTRATA_ORG}.entrata.com/api/v1/leads`;

const payload = {
  auth: {
    type: "apikey",
    key: process.env.ENTRATA_API_KEY
  },
  requestId: "1",
  method: {
    name: "createLead",
    version: "r1",
    params: {
      propertyId: parseInt(req.body.propertyId || "100016881", 10),
      name: `${req.body.firstName} ${req.body.lastName}`,
      telephone: req.body.phone,
      email: req.body.email,
      leadStatusIds: "1" // adjust if Entrata uses a different status for "new lead"
    }
  }
};

try {
  const response = await fetch(entrataUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await response.json();
  console.log("Entrata API Response:", data);
  res.status(200).json({ success: true, data });

} catch (error) {
  console.error("Error sending lead to Entrata:", error);
  res.status(500).json({ success: false, error: error.message });
}
