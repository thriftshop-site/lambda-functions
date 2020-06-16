if (!process.env.NETLIFY) {
  require("dotenv").config();
}

const { GoogleSpreadsheet } = require("google-spreadsheet");

const {
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GOOGLE_SPREADSHEET_ID_FROM_URL,
} = process.env;

if (!GOOGLE_SERVICE_ACCOUNT_EMAIL)
  throw new Error("no GOOGLE_SERVICE_ACCOUNT_EMAIL env var set");
if (!GOOGLE_PRIVATE_KEY) throw new Error("no GOOGLE_PRIVATE_KEY env var set");
if (!GOOGLE_SPREADSHEET_ID_FROM_URL)
  throw new Error("no GOOGLE_SPREADSHEET_ID_FROM_URL env var set");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
      headers: { Allow: "POST" },
    };
  }

  try {
    const doc = new GoogleSpreadsheet(GOOGLE_SPREADSHEET_ID_FROM_URL);

    await doc.useServiceAccountAuth({
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY,
    });

    await doc.loadInfo();

    await doc.updateProperties({
      title: "Product Purchase Record",
    });

    const sheet = doc.sheetsByIndex[0];

    try {
      await sheet.loadHeaderRow();
    } catch (error) {
      console.log("Setting up Spreadsheet Header For The First Time");

      await sheet.setHeaderRow([
        "reference_no",
        "payment_id",
        "paid",
        "date_paid",
        "mop",
        "net_amount",
        "currency",
        "sent",
        "courier",
        "tracking_no",
        "order_details",
        "receiver_name",
        "receiver_phone",
        "notes",
        "received",
        "delivery_address",
        "payer_name",
        "payer_email",
        "payer_phone",
        "billing_address",
        "remarks",
      ]);
    }

    const {
      reference_no = null,
      address = null,
      notes = null,
      receiver_name = null,
      receiver_phone = null,
    } = JSON.parse(event.body);

    if (!reference_no && !address && !receiver_name && !receiver_phone) {
      let error = {
        statusCode: 422,
        body:
          "Reference No, and Delivery Address, Receiver Name and Phone  are Required!",
      };
      return error;
    }

    const newRow = await sheet.addRow({
      reference_no,
      receiver_name,
      receiver_phone,
      delivery_address: address,
      notes,
    });

    return {
      statusCode: 201,
      body: JSON.stringify({
        message: `POST Success - added row ${newRow._rowNumber - 1}`,
        rowNumber: newRow._rowNumber - 1,
      }),
    };
  } catch (e) {
    console.log(e.toString());
    return {
      statusCode: 500,
      body: e.toString(),
    };
  }
};
