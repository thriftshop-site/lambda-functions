require("dotenv").config();
const axios = require("axios");
const CREATE_URI = "https://gateway.paymongo.com/transactions";
const AUTH_URI = "https://gateway.paymongo.com/auth";
const { PAYMONGO_EMAIL, PAYMONGO_PASS, PAYMONGO_LIVEMODE } = process.env;

exports.handler = async function (event) {
    if (event.httpMethod !== "POST") {
        let error = {
            statusCode: 405,
            body: "Method Not Allowed",
            headers: { Allow: "POST" },
        };
        return error;
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
        } catch (error) {
            console.log(error);
            return error;
        }
    };

    const { amount, description, remarks = "" } = JSON.parse(event.body);

    if (!amount || !description) {
        let error = {
            statusCode: 422,
            body: "amount, and description are required.",
        };
        return error;
    }

    let livemode = false;

    if (PAYMONGO_LIVEMODE === true || PAYMONGO_LIVEMODE == "true") {
        livemode = true;
    }

    let payload = {
        data: {
            attributes: {
                amount,
                description,
                livemode,
                remarks,
            },
        },
    };

    const createLink = async (token) => {
        axios.defaults.headers.common["Authorization"] = "Bearer " + token;

        try {
            const res = await axios({
                method: "post",
                url: CREATE_URI,
                data: payload,
            });
            const data = await res.data;
            return data;
        } catch (error) {
            console.log(error);
            return error;
        }
    };

    const token = await getApiToken();
    const data = await createLink(token);

    return {
        statusCode: 200,
        body: JSON.stringify(data),
    };
};
