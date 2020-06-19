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

exports.handler = async (event) => {
  
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
        body: "Reference No is Required!",
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
    if (
      rows[rowIndex].received == "no" ||
      rows[rowIndex].received == false
    ) {
      rows[rowIndex].received = "yes";
    } else {
      rows[rowIndex].received = "no";
    }
    var isReceived = "Order Has Been Mark As Not Yet Received"
    if(rows[rowIndex].received == "yes"){
        isReceived = "Order Has Been Mark As Received";
    }
    
    await rows[rowIndex].save();

    return {
      statusCode: 200,
      body: JSON.stringify({
        message: `${isReceived}`,
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      body: e.toString(),
    };
  }
};
