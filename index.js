const payload = {
  auth: {
    type: "apikey",
    key: process.env.ENTRATA_API_KEY
  },
  requestId: "1",
  method: {
    name: "sendLeads",
    version: "r1",
    params: {
      propertyId: 100016881,
      doNotSendConfirmationEmail: "1",
      isWaitList: "0",
      prospects: {
        prospect: {
          customers: {
            customer: {
              name: {
                firstName: req.body.firstName,
                lastName: req.body.lastName
              },
              phone: {
                personalPhoneNumber: req.body.phone
              },
              email: req.body.email
            }
          }
        }
      }
    }
  }
};
