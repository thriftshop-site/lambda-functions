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

    const { reference_no = null } = JSON.parse(event.body);

    if (!reference_no) {
        let error = {
            statusCode: 422,
            body: JSON.stringify({
                message: "Reference Number is Required!",
            }),
        };
        return error;
    }

    try {
        const doc = new GoogleSpreadsheet(GOOGLE_SPREADSHEET_ID_FROM_URL);
        await doc.useServiceAccountAuth({
            client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        });
        await doc.loadInfo();

        const purchase_sheet = doc.sheetsById[1];

        const rows = await purchase_sheet.getRows();
        const rowIndex = rows.findIndex((x) => x.reference_no == reference_no);

        if (rowIndex == -1) {
            let error = {
                statusCode: 404,
                body: JSON.stringify({
                    message: "Reference Number Not Found!",
                }),
            };
            return error;
        }
        let message =
            "Oops!Request Failed. We Already Marked This Transaction as DONE";

        if (
            (rows[rowIndex].remarks === "DONE" && rows[rowIndex].received == "yes") ||
            (rows[rowIndex].remarks === "done" && rows[rowIndex].received == "yes")
        ) {
            let error = {
                statusCode: 400,
                body: JSON.stringify({
                    message,
                }),
            };
            return error;
        } else if (
            (rows[rowIndex].remarks === "DONE" && rows[rowIndex].received == "no") ||
            (rows[rowIndex].remarks === "done" && rows[rowIndex].received == "no")
        ) {
            rows[rowIndex].received = "yes";
            message = "Transaction is DONE Already and marked as Received!";
        } else {
            if (rows[rowIndex].received == "no" || rows[rowIndex].received == false) {
                rows[rowIndex].received = "yes";
                message = "Order Marked As Received!";
            } else {
                rows[rowIndex].received = "no";
                message = "Order Unmarked as Received!";
            }
        }
        await rows[rowIndex].save();

        return {
            statusCode: 200,
            body: JSON.stringify({
                message,
            }),
        };
    } catch (e) {
        return {
            statusCode: 500,
            body: e.toString(),
        };
    }
};
