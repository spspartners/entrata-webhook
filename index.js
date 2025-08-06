const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

app.post('/', async (req, res) => {
  const { firstName, lastName, email, phone, notes } = req.body;
  // TODO: Replace with secure server-side OAuth for Entrata
  const token = process.env.ENTRATA_TOKEN || 'TEST_TOKEN';
  try {
    const resp = await fetch('https://api.entrata.com/leads', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        firstName,
        lastName,
        email,
        phone,
        notes,
        propertyId: process.env.ENTRATA_PROPERTY_ID || 'PROPERTY_ID',
      }),
    });
    if (!resp.ok) throw new Error(await resp.text());
    res.status(200).send('OK');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Webhook listening on port ${port}`));
