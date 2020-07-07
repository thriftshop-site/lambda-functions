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

    let validationError = [];

    const {
        reference_no = null,
        referral = null,
        deliverable = true,
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

    if (deliverable) {
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

        if (rowIndex > -1) {
            let error = {
                statusCode: 400,
                body: JSON.stringify({ error: "Purchase Record Already Exist!" }),
            };
            return error;
        }

        var newRow;

        if (deliverable) {
            newRow = await purchase_sheet.addRow({
                reference_no,
                referral_code: referral,
                receiver_name,
                receiver_phone,
                delivery_address: address,
                deliverable,
                notes,
            });
        } else {
            newRow = await purchase_sheet.addRow({
                reference_no,
                referral_code: referral,
                deliverable,
                sent: "N/A",
                courier: "N/A",
                tracking_no: "N/A",
                notes,
            });
        }

        return {
            statusCode: 201,
            body: JSON.stringify({
                message: "Successfully Created A New Purchase!",
                rowNumber: newRow._rowNumber - 1,
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
