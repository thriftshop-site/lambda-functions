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

    const { reference_no = null } = JSON.parse(event.body);

    if (!reference_no) {
        let error = {
            statusCode: 422,
            body: "Reference is Required!",
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

        var purchase_sheet = doc.sheetsById[1];

        if (!purchase_sheet) {
            await doc.addSheet({
                headerValues: [
                    "reference_no",
                    "deliverable",
                    "sent",
                    "courier",
                    "tracking_no",
                    "remarks",
                    "pm_link",
                    "payment_id",
                    "paid",
                    "date_paid",
                    "mop",
                    "currency",
                    "net_amount",
                    "fee",
                    "payout_date",
                    "referral_code",
                    "referral_fee",
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
                ],
                sheetId: 1,
                gridProperties: {
                    rowCount: 1000,
                    columnCount: 27,
                },
                title: "Purchases",
            });

            purchase_sheet = doc.sheetsById[1];
        }

        try {
            await purchase_sheet.loadHeaderRow();
        } catch (e) {
            await purchase_sheet.resize({ rowCount: 1000, columnCount: 27 });

            await purchase_sheet.setHeaderRow([
                "reference_no",
                "deliverable",
                "sent",
                "courier",
                "tracking_no",
                "remarks",
                "pm_link",
                "payment_id",
                "paid",
                "date_paid",
                "mop",
                "currency",
                "net_amount",
                "fee",
                "payout_date",
                "referral_code",
                "referral_fee",
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
            ]);
        }

        const rows = await purchase_sheet.getRows();

        const rowIndex = rows.findIndex((x) => x.reference_no == reference_no);

        if (rowIndex === -1) {
            let error = {
                statusCode: 400,
                body: JSON.stringify({ error: "Reference Number Not Found!" }),
            };
            return error;
        }

        let header = purchase_sheet.headerValues;

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
