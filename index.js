const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

app.post('/', async (req, res) => {
  const { firstName, lastName, email, phone, notes, propertyId } = req.body;

  try {
    const leadData = {
      firstName,
      lastName,
      email,
      phone,
      notes,
      propertyId
    };

    const response = await fetch(`${process.env.ENTRATA_BASE_URL}/leads`, {
      method: 'POST',
      headers: {
        'X-Api-Key': process.env.ENTRATA_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(leadData)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Entrata error: ${errorText}`);
    }

    res.status(200).send('Lead sent to Entrata successfully');
  } catch (err) {
    console.error(err);
    res.status(500).send('Failed to send lead to Entrata');
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Webhook listening on port ${port}`));
