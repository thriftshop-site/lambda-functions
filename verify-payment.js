if (!process.env.NETLIFY) {
  require("dotenv").config();
}
const { GoogleSpreadsheet } = require("google-spreadsheet");
const axios = require("axios");

const {
  GOOGLE_SERVICE_ACCOUNT_EMAIL,
  GOOGLE_PRIVATE_KEY,
  GOOGLE_SPREADSHEET_ID_FROM_URL,
  PAYMONGO_EMAIL,
  PAYMONGO_PASS,
  PAYMONGO_LIVEMODE,
} = process.env;

if (!GOOGLE_SERVICE_ACCOUNT_EMAIL)
  throw new Error("No GOOGLE_SERVICE_ACCOUNT_EMAIL env var set");
if (!GOOGLE_PRIVATE_KEY) throw new Error("No GOOGLE_PRIVATE_KEY env var set");
if (!GOOGLE_SPREADSHEET_ID_FROM_URL)
  throw new Error("No GOOGLE_SPREADSHEET_ID_FROM_URL env var set");
if (!PAYMONGO_EMAIL) throw new Error("No PAYMONGO_EMAIL env var set");
if (!PAYMONGO_PASS) throw new Error("No PAYMONGO_PASS env var set");
if (!PAYMONGO_LIVEMODE) throw new Error("No PAYMONGO_LIVEMODE env var set");

const URL = "https://gateway.paymongo.com/transactions";
const AUTH_URI = "https://gateway.paymongo.com/auth";

exports.handler = async (event, context, callback) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
      headers: { Allow: "POST" },
    };
  }
  let credentials = {
    data: {
      attributes: {
        email: PAYMONGO_EMAIL,
        password: PAYMONGO_PASS,
      },
    },
  };
  const getApiToken = async () => {
    try {
      const res = await axios({
        method: "post",
        url: AUTH_URI,
        data: credentials,
      });
      const token = await res.data.data.id;
      return token;
    } catch (error) {
      console.log(error);
      return error;
    }
  };
  try {
    const doc = new GoogleSpreadsheet(GOOGLE_SPREADSHEET_ID_FROM_URL);

    await doc.useServiceAccountAuth({
      client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: GOOGLE_PRIVATE_KEY,
    });

    await doc.loadInfo();

    const sheet = doc.sheetsByIndex[0];

    const { reference_no = null } = JSON.parse(event.body);

    if (!reference_no) {
      let error = {
        statusCode: 422,
        body: "Reference is Required!",
      };
      return error;
    }
    const rows = await sheet.getRows();

    sheet.loadHeaderRow();

    const rowIndex = rows.findIndex((x) => x.reference_no == reference_no);

    if (rowIndex == -1) {
      let error = {
        statusCode: 400,
        body: "Reference Number Not Found!",
      };
      return error;
    }

    let endpoint = `${URL}/${reference_no}?livemode=${PAYMONGO_LIVEMODE}`;

    const token = await getApiToken();

    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    let payment = await axios.get(endpoint);

    let attributes = payment.data.data.attributes;

    const { status } = attributes;

    if (status == "unpaid") {
      return {
        statusCode: 200,
        body: JSON.stringify({
          message: "UNPAID!",
        }),
      };
    }

    let payments = attributes.payments;

    const paymentIndex = payments.findIndex((x) => x.status === "paid");

    let payment_details = attributes.payments[paymentIndex];

    const {
      id,
      currency,
      net_amount,
      mop_text,
      description,
      paid_at,
      billing,
      remarks,
    } = payment_details;

    const { name, email, phone, address } = billing;

    const { city, country, line1, line2, postal_code, state } = address;

    let fullAddress = `${line1} ${line2},${city} ${state} ${postal_code}, ${country}`;

    let newDate = new Date(paid_at * 1000);
    let d = newDate.getDate();
    let m = newDate.getMonth();
    let y = newDate.getFullYear();

    //! Useful for Refund
    let date_paid = `${y}-${m}-${d}`;

    rows[rowIndex].paid = "yes";
    rows[rowIndex].date_paid = date_paid;
    rows[rowIndex].payment_id = id;
    rows[rowIndex].net_amount = net_amount / 100;
    rows[rowIndex].currency = currency;
    rows[rowIndex].mop = mop_text;
    rows[rowIndex].order_details = description;
    rows[rowIndex].payer_name = name;
    rows[rowIndex].payer_email = email;
    rows[rowIndex].payer_phone = phone;
    rows[rowIndex].billing_address = fullAddress;
    row[rowIndex].remarks = remarks;

    await rows[rowIndex].save();

    let header = sheet.headerValues;

    const rowData = {};

    header.forEach((element) => {
      rowData[element] = rows[rowIndex][element];
    });

    return {
      statusCode: 200,
      body: JSON.stringify(rowData),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: e.toString(),
    };
  }
};
