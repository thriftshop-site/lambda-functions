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
    var sheet;

    if (doc.sheetCount < 2) {
      await doc.addSheet({
        headerValues: [
          "referral_code",
          "name",
          "email",
          "type", // type can be fix or percentage
          "amount",
          "active",
        ],
      });
      sheet = doc.sheetsByIndex[1];
      await sheet.updateProperties({ title: "Referrals" });
    }

    try {
      sheet = doc.sheetsByIndex[1];
      await sheet.loadHeaderRow();
    } catch (error) {
      await sheet.updateProperties({ title: "Referrals" });
      await sheet.setHeaderRow([
        "referral_code",
        "name",
        "email",
        "type", // type can be fix or percentage
        "amount",
        "active",
      ]);
    }
    const {
      username = null,
      name = null,
      email = null,
      type = "percent", // fixed or percent
      amount = "10",
      active = false, // true or false
    } = JSON.parse(event.body);

    let validationError = [];

    const referral_types = ["fixed", "percent"];

    if (!username) {
      let error = {
        field: "username",
        message: "No Username Submitted, *username* is required",
      };
      validationError.push(error);
    }

    if (!email) {
      let error = {
        field: "email",
        message: "No Email Submitted, *email* is required",
      };
      validationError.push(error);
    }

    if (!name) {
      let error = {
        field: "name",
        message: "No Name Submitted, *name* is required",
      };
      validationError.push(error);
    }

    if (!referral_types.includes(type)) {
      let error = {
        field: "type",
        message: "Invalid Type is Provided!",
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

    if (sheet.rowCount > 0) {
      const rowIndex = rows.findIndex((x) => x.referral_code == username);

      if (rowIndex > -1) {
        let error = {
          statusCode: 400,
          body: JSON.stringify({ error: "Record Already Exist!" }),
        };
        return error;
      }
    }

    await sheet.addRow({
      referral_code: username,
      name,
      type,
      active,
      email,
      amount,
    });

    let message = "Please Wait For Us To Approved Your Application";
    if (active || active == "true" || active == true) {
      message = "You Have Successfully Join Our Referral Program!";
    }

    return {
      statusCode: 201,
      body: JSON.stringify({
        message,
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
