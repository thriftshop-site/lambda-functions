if (!process.env.NETLIFY) {
  require("dotenv").config();
}
if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL)
  throw new Error("no GOOGLE_SERVICE_ACCOUNT_EMAIL env var set");
if (!process.env.GOOGLE_PRIVATE_KEY)
  throw new Error("no GOOGLE_PRIVATE_KEY env var set");
if (!process.env.GOOGLE_SPREADSHEET_ID_FROM_URL)
  throw new Error("no GOOGLE_SPREADSHEET_ID_FROM_URL env var set");

const { GoogleSpreadsheet } = require("google-spreadsheet");

exports.handler = async (event, context, callback) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
      headers: { Allow: "POST" },
    };
  }
  try {
    const doc = new GoogleSpreadsheet(
      process.env.GOOGLE_SPREADSHEET_ID_FROM_URL
    );
    await doc.useServiceAccountAuth({
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY,
    });
    await doc.loadInfo();
    await doc.updateProperties({
      title: "Product Purchase Record",
    });
    const sheet = doc.sheetsByIndex[0];
    try {
      await sheet.loadHeaderRow();
    } catch (error) {
      await sheet.setHeaderRow([
        "reference_no",
        "net_amount",
        "currency",
        "mop",
        "paid",
        "payment_id",
        "sent",
        "tracking_no",
        "received",
        "name",
        "email",
        "phone",
        "courier",
        "order_details",
        "billing_address",
        "delivery_address",
        "remarks",
      ]);
    }
    //! we need the following variable stored at local storage prior checkout!
    //! we need a multiform step checkout at the end redirect to PM link
    //! Parameters
    const {
      reference_no = null,
      address = null,
      courier = null,
    } = JSON.parse(event.body);

    if (
      !reference_no ||
      !address
    ) {
      let error = {
        statusCode: 422,
        body:
          "Reference No, and Delivery Address  are Required!",
      };
      return {
        statusCode: 422,
        body: JSON.stringify(error),
      };
    }
    const newRow = await sheet.addRow({
      reference_no,
      delivery_address: address,
      courier
    });

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `POST Success - added row ${newRow._rowNumber - 1}`,
        rowNumber: newRow._rowNumber - 1,
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: e.toString(),
    };
  }
};
