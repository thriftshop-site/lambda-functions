require("dotenv").config();
const axios = require("axios");

const URL = "https://gateway.paymongo.com/auth";
const { PAYMONGO_EMAIL, PAYMONGO_PASS } = process.env;

exports.handler = function (event, context, callback) {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: "Method Not Allowed",
      headers: { Allow: "POST" },
    };
  }
  let payload = {
    data: {
      attributes: {
        email: PAYMONGO_EMAIL,
        password: PAYMONGO_PASS,
      },
    },
  };
  // send response
  const send = (body) => {
    let response = {};
    response.token = body.data.id;
    let date = new Date();
    response.expired_at = date.setTime(
      date.getTime() + body.data.attributes.expiry_timer * 1000
    );

    callback(null, {
      statusCode: 200,
      body: JSON.stringify(response),
    });
  };
  // perform api call
  const getApiToken = () => {
    axios({
      method: "post",
      url: URL,
      data: payload,
    })
      .then((res) => send(res.data))
      .catch((err) => send(err));
  };
  // Makesure method is GET
  if (event.httpMethod == "POST") {
    getApiToken();
  }
};
