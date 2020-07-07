if (!process.env.NETLIFY) {
    require("dotenv").config();
}
const { GoogleSpreadsheet } = require("google-spreadsheet");
const axios = require("axios");

const {
    GOOGLE_SERVICE_ACCOUNT_EMAIL,
    GOOGLE_PRIVATE_KEY,
    GOOGLE_SPREADSHEET_ID_FROM_URL,
    PAYMONGO_EMAIL,
    PAYMONGO_PASS,
    PAYMONGO_LIVEMODE,
} = process.env;

if (!GOOGLE_SERVICE_ACCOUNT_EMAIL)
    throw new Error("No GOOGLE_SERVICE_ACCOUNT_EMAIL env var set");
if (!GOOGLE_PRIVATE_KEY) throw new Error("No GOOGLE_PRIVATE_KEY env var set");
if (!GOOGLE_SPREADSHEET_ID_FROM_URL)
    throw new Error("No GOOGLE_SPREADSHEET_ID_FROM_URL env var set");
if (!PAYMONGO_EMAIL) throw new Error("No PAYMONGO_EMAIL env var set");
if (!PAYMONGO_PASS) throw new Error("No PAYMONGO_PASS env var set");
if (!PAYMONGO_LIVEMODE) throw new Error("No PAYMONGO_LIVEMODE env var set");

const URL = "https://gateway.paymongo.com/transactions";
const AUTH_URI = "https://gateway.paymongo.com/auth";

exports.handler = async (event, context, callback) => {
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
            message: "No Reference No. Submitted, *reference_no* is required",
        };
        validationError.push(error);
    }

    if (validationError.length > 0) {
        return {
            statusCode: 422,
            body: JSON.stringify({ errors: validationError }),
        };
    }

    let credentials = {
        data: {
            attributes: {
                email: PAYMONGO_EMAIL,
                password: PAYMONGO_PASS,
            },
        },
    };

    const getApiToken = async () => {
        try {
            const res = await axios({
                method: "post",
                url: AUTH_URI,
                data: credentials,
            });
            const token = await res.data.data.id;
            return token;
        } catch (e) {
            return {
                statusCode: 500,
                body: e.toString(),
            };
        }
    };

    try {
        const doc = new GoogleSpreadsheet(GOOGLE_SPREADSHEET_ID_FROM_URL);

        await doc.useServiceAccountAuth({
            client_email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
            private_key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        });

        await doc.loadInfo();

        const purchase_sheet = doc.sheetsById[1];

        const rows = await purchase_sheet.getRows();

        purchase_sheet.loadHeaderRow();

        const rowIndex = rows.findIndex((x) => x.reference_no == reference_no);

        if (rowIndex == -1) {
            let error = {
                statusCode: 404,
                body: JSON.stringify({ error: "Reference Number Not Found!" }),
            };
            return error;
        }

        let verified = rows[rowIndex].paid == "yes" ? true : false;

        if (verified) {
            let error = {
                statusCode: 400,
                body: JSON.stringify({ message: "Payment is Already Verified!" }),
            };
            return error;
        }

        let endpoint = `${URL}/${reference_no}?livemode=${PAYMONGO_LIVEMODE}`;

        const token = await getApiToken();

        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

        let payment = await axios.get(endpoint);

        let attributes = payment.data.data.attributes;

        const { status, url } = attributes;

        if (status == "unpaid") {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    message: "Go to This Link and Settle Payment: " + url,
                    url,
                }),
            };
        }

        let payments = attributes.payments;

        const paymentIndex = payments.findIndex((x) => x.status === "paid");

        let payment_details = attributes.payments[paymentIndex];

        const {
            id,
            currency,
            net_amount,
            fee,
            mop_text,
            description,
            paid_at,
            available_at,
            billing,
        } = payment_details;

        const { name, email, phone, address } = billing;

        const { city, country, line1, line2, postal_code, state } = address;

        let fullAddress = `${line1} ${line2},${city} ${state} ${postal_code}, ${country}`;

        let newDate = new Date(paid_at * 1000);

        let d = newDate.getDate();
        let m = newDate.getMonth();
        let y = newDate.getFullYear();

        let newDate1 = new Date(available_at * 1000);

        let d1 = newDate1.getDate();
        let m1 = newDate1.getMonth();
        let y1 = newDate1.getFullYear();

        let date_paid = `${y}-${m}-${d}`;
        let payout_date = `${y1}-${m1}-${d1}`;

        rows[rowIndex].paid = "yes";
        rows[rowIndex].pm_link = url;
        rows[rowIndex].date_paid = date_paid;
        rows[rowIndex].payment_id = id;
        rows[rowIndex].payout_date = payout_date;
        rows[rowIndex].currency = currency;
        rows[rowIndex].net_amount = parseFloat(parseInt(net_amount) / 100);
        rows[rowIndex].fee = parseFloat(parseInt(fee) / 100);
        rows[rowIndex].mop = mop_text;
        rows[rowIndex].order_details = description;
        rows[rowIndex].payer_name = name;
        rows[rowIndex].payer_email = email;
        rows[rowIndex].payer_phone = phone;
        rows[rowIndex].billing_address = fullAddress;

        const username = rows[rowIndex].referral_code
            ? rows[rowIndex].referral_code
            : null;

        if (username) {
            const referrals = doc.sheetsById[2];

            const referrals_rows = await referrals.getRows();

            if (referrals.rowCount > 0) {
                const ref_index = referrals_rows.findIndex(
                    (x) => x.referral_code == username
                );
                if (referrals_rows[ref_index].active === "TRUE") {
                    if (ref_index != -1) {
                        switch (referrals_rows[ref_index].type) {
                            case "fixed":
                                rows[rowIndex].referral_fee = referrals_rows[ref_index].amount;
                                break;
                            default:
                                rows[rowIndex].referral_fee =
                                    parseFloat(parseInt(net_amount) / 100) *
                                    (parseFloat(referrals_rows[ref_index].amount) / 100);
                                break;
                        }
                    }
                } else {
                    rows[rowIndex].referral_code = "";
                }
            }
        }

        await rows[rowIndex].save();

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: "Payment Has Been Verified , Thank You!",
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
