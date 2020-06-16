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
  throw new Error("No GOOGLE_SERVICE_ACCOUNT_EMAIL env var set");
if (!GOOGLE_PRIVATE_KEY) throw new Error("No GOOGLE_PRIVATE_KEY env var set");
if (!GOOGLE_SPREADSHEET_ID_FROM_URL)
  throw new Error("No GOOGLE_SPREADSHEET_ID_FROM_URL env var set");


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
        statusCode: 404,
        body: "Reference Number Not Found!",
      };
      return error;
    }

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
    console.log(e.toString());
    return {
      statusCode: 500,
      body: e.toString(),
    };
  }
};
