const axios = require("axios");
const URL = "https://gateway.paymongo.com/transactions";

exports.handler = function (event, context, callback) {
  const send = (body) => {
    callback(null, {
      statusCode: 200,
      body: JSON.stringify(body),
    });
  };

  if (event.httpMethod !== "POST") {
    let error = {
      statusCode: 405,
      body: "Method Not Allowed",
      headers: { Allow: "POST" },
    };
    send(error);
  }

  // parse data , add default value for livemode and remarks
  const { amount, description, remarks = "", livemode = false } = JSON.parse(
    event.body
  );

  // validate data
  if (!amount || !description) {
    let error = {
      statusCode: 422,
      body: "amount, and description are required.",
    };
    send(error);
  }

  // parse api token
  const token = event.headers.authorization;

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

  // perform api call
  const createLink = () => {
    // attach bearer token
    axios.defaults.headers.common["Authorization"] = token;
    axios({
      method: "post",
      url: URL,
      data: payload,
    })
      .then((res) => send(res.data))
      .catch((err) => send(err));
  };
  if (event.httpMethod == "POST") {
    createLink();
    //TODO emailLink()
  }
};
