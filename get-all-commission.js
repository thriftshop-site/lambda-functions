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
            body: JSON.stringify({ error: "Method Not Allowed!" }),
            headers: { Allow: "POST" },
        };
    }

    let validationError = [];

    const { referral_code = null } = JSON.parse(event.body);

    if (!referral_code) {
        let error = {
            field: "referral_code",
            message: "No Referral Code Submitted",
        };
        validationError.push(error);
    }

    if (validationError.length > 0) {
        return {
            statusCode: 422,
            body: JSON.stringify({ errors: validationError }),
        };
    }
    try {
        const doc = new GoogleSpreadsheet(GOOGLE_SPREADSHEET_ID_FROM_URL);

        await doc.useServiceAccountAuth({
            client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        });

        await doc.loadInfo();

        var purchase_sheet = doc.sheetsById[1];

        const rows = await purchase_sheet.getRows();

        purchase_sheet.loadHeaderRow();

        const referrals = rows.filter((x) => x.referral_code == referral_code);

        if (referrals.length < 0) {
            let error = {
                statusCode: 404,
                body: JSON.stringify({ error: "Referral Code Not Found!" }),
            };
            return error;
        }

        const commmissions = referrals.map((x) => x.referral_fee);

        return {
            statusCode: 200,
            body: JSON.stringify(commmissions),
        };
    } catch (e) {
        console.log(e.toString());
        return {
            statusCode: 500,
            body: e.toString(),
        };
    }
};
