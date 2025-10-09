const http = require("http");

function aldaagIlgeeye(aldaa, req) {
  const data = new TextEncoder().encode(
    JSON.stringify({
      system: "AmarSukh",
      aldaa: aldaa,
      aldaaniiMsg: aldaa.message,
      ognoo: new Date(),
      baiguullagiinId: req.body.baiguullagiinId,
      burtgesenAjiltaniiId: req.body.nevtersenAjiltniiToken.id,
      burtgesenAjiltaniiNer: req.body.nevtersenAjiltniiToken.ner,
    })
  );
  const options = {
    hostname: "103.143.40.123",
    port: 8282,
    path: "/aldaa",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  };
  const request = http.request(options, (response) => {
    response.on("data", (d) => {});
  });
  request.on("error", (error) => {});

  request.write(data);
  request.end();
}
const aldaaBarigch = (err, req, res, next) => {
  try {
    if (req.body && req.body.nevtersenAjiltniiToken) aldaagIlgeeye(err, req);
    if (!!err.message && err.message.includes("indexTalbar_1 dup key"))
      err.message = "Нэвтрэх нэр давхардаж байна!";
    else if (
      !!err.message &&
      !!err.message.includes("connect ECONNREFUSED 103.143.40.123:8282")
    ) {
      err.message = "Лицензийн хэсэгтэй холбогдоход алдаа гарлаа!";
    }
    res.status(err.kod || 500).json({
      success: false,
      aldaa: err.message,
    });
  } catch (error) {
    if (!!next) next(error);
  }
};

module.exports = aldaaBarigch;
