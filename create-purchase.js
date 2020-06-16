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
      body: JSON.stringify({ error: "Method Not Allowed!" }),
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
        "pm_link",
        "payment_id",
        "paid",
        "date_paid",
        "mop",
        "currency",
        "net_amount",
        "fee",
        "payout_date",
        "sent",
        "courier",
        "tracking_no",
        "received",
        "order_details",
        "receiver_name",
        "receiver_phone",
        "notes",
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
      receiver_name = null,
      receiver_phone = null,
      address = null,
      notes = null,
    } = JSON.parse(event.body);

    let validationError = [];

    if (!reference_no) {
      let error = {
        field: "reference_no",
        message: "No Reference No Submitted, *reference_no* is required",
      };
      validationError.push(error);
    }

    if (!address) {
      let error = {
        field: "address",
        message: "No Address No Submitted, *address* is required",
      };
      validationError.push(error);
    }

    if (!receiver_name) {
      let error = {
        field: "receiver_name",
        message: "No Receiver Name Submitted, *receiver_name* is required",
      };
      validationError.push(error);
    }

    if (!receiver_phone) {
      let error = {
        field: "receiver_phone",
        message: "No Receiver Phone Submitted, *receiver_phone* is required",
      };
      validationError.push(error);
    }

    if (validationError.length > 0) {
      return {
        statusCode: 422,
        body: JSON.stringify({ errors: validationError }),
      };
    }

    const rows = await sheet.getRows();

    const rowIndex = rows.findIndex((x) => x.reference_no == reference_no);

    if (rowIndex > -1) {
      let error = {
        statusCode: 400,
        body: JSON.stringify({ error: "Purchase Record Already Exist!" }),
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
