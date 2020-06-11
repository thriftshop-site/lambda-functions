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
const axios = require("axios");
const URL = "https://gateway.paymongo.com/transactions";



exports.handler = async (event, context, callback) => {
    const send = (body) => {
    callback(null, {
      statusCode: 200,
      body: JSON.stringify(body),
    });
  };
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

    const sheet = doc.sheetsByIndex[0];
    const { reference_no = null } = JSON.parse(event.body);

    if (!reference_no) {
      let error = {
        statusCode: 422,
        body: "Reference is Required!",
      };
      return {
        statusCode: 500,
        body: JSON.stringify(error),
      };
    }
    const rows = await sheet.getRows();
    const rowIndex = rows.findIndex((x) => x.reference_no == reference_no);

    if (rowIndex == -1) {
      let error = {
        statusCode: 404,
        body: "Reference Number Not Found!",
      };
      return {
        statusCode: 404,
        body: JSON.stringify(error),
      };
    }
    let endpoint = `${URL}/${reference_no}?livemode=${process.env.PAYMONGO_LIVEMODE}`;
      //! CALL GET TOKEN!!! 
      // const token = call get token;
      axios.defaults.headers.common["Authorization"] = `Bearer ${process.env.PAYMONGO_TOKEN}`;
      let payment = await axios.get(endpoint);
      let attributes = payment.data.data.attributes
      const {status} = attributes;
      if(status == 'unpaid'){
          return {
           statusCode: 200,
           body: JSON.stringify({
           message: "UNPAID!",
           }),
        };
      }
      
    let payment_details = attributes.payments[0];
    const {id,currency,net_amount,mop_text,description,billing} = payment_details;
    const {name,email,phone,address} = billing;
    const {city,country,line1,line2,postal_code,state} = address;
      
    
    rows[rowIndex].paid = "yes";
    rows[rowIndex].payment_id = id;
    rows[rowIndex].net_amount = net_amount/100;
    rows[rowIndex].currency = currency;
    rows[rowIndex].mop = mop_text;
    rows[rowIndex].order_details = description;
    rows[rowIndex].name = name;
    rows[rowIndex].email = email;
    rows[rowIndex].phone = phone;
    rows[rowIndex].billing_address = `${line1} ${line2},${city} ${state} ${postal_code}, ${country}`;
    await rows[rowIndex].save();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "Payment Verified",
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: e.toString(),
    };
  }
};
