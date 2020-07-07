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

    let validationError = [];

    const {
        reference_no = null,
        receiver_name = null,
        receiver_phone = null,
        address = null,
        notes = null,
    } = JSON.parse(event.body);

    if (!reference_no) {
        let error = {
            field: "reference_no",
            message: "No Reference Number Submitted",
        };
        validationError.push(error);
    }

    if (!address) {
        let error = {
            field: "address",
            message: "No Address Submitted",
        };
        validationError.push(error);
    }

    if (!receiver_name) {
        let error = {
            field: "receiver_name",
            message: "No Name Submitted",
        };
        validationError.push(error);
    }

    if (!receiver_phone) {
        let error = {
            field: "receiver_phone",
            message: "No Contact No. Submitted",
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

        const purchase_sheet = doc.sheetsById[1];

        const rows = await purchase_sheet.getRows();
        const rowIndex = rows.findIndex((x) => x.reference_no == reference_no);

        if (rowIndex == -1) {
            let error = {
                statusCode: 404,
                body: "Reference Number Not Found!",
            };
            return error;
        }
        let message = "";

        if (!rows[rowIndex].deliverable || rows[rowIndex].deliverable === "FALSE") {
            message =
                "Opps! Cant Updated Delivery Address, The Type of Purchase was Non-Deliverable!";
        } else {
            if (
                rows[rowIndex].received === "no" ||
                rows[rowIndex].received == false
            ) {
                rows[rowIndex].receiver_name = receiver_name;
                rows[rowIndex].receiver_phone = receiver_phone;
                rows[rowIndex].delivery_address = address;
                rows[rowIndex].notes = notes;
                rows[rowIndex].deliverable = true;
                await rows[rowIndex].save();
                message = "Delivery Address Updated.";
            } else {
                message =
                    "Oops! Cant Update Delivery Address, Product Purchase was Already Received!";
            }
        }

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
