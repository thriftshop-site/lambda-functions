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

    const { reference_no = null } = JSON.parse(event.body);

    let validationError = [];

    if (!reference_no) {
        let error = {
            field: "reference_no",
            message: "No Reference Number. Submitted",
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

        const sheet = doc.sheetsById[1];

        const rows = await sheet.getRows();

        const rowIndex = rows.findIndex((x) => x.reference_no == reference_no);

        if (rowIndex == -1) {
            let error = {
                statusCode: 404,
                body: JSON.stringify({ error: "Reference Number Not Found!" }),
            };
            return error;
        }

        const {
            tracking_no = "",
            courier = "",
            sent = null,
            deliverable = true
        } = rows[rowIndex];

        if (!deliverable || deliverable === "FALSE") {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Order is Not Considered as *Deliverable*",
                }),
            };
        }

        if (!sent || (sent && sent.toLowerCase() != "yes")) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Order Not Yet Delivered",
                }),
            };
        }

        return {
            statusCode: 200,
            body: JSON.stringify({
                tracking_no,
                courier,
                sent,
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
