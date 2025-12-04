const { admin } = require("../middleware/firebase-config");

async function sonorduulgaIlgeeye(token, medeelel, callback, next) {
  const payload = {
    token,
    webpush: {
      TTL: 86400,
      notification: {
        title: "Таньд мэдэгдэл ирлээ!",
        body: "Hello world",
        icon: "default",
        sound: "default",
        badge: "1",
        ...medeelel,
      },
    },
    android: {
      priority: "normal",
      TTL: 86400,
      notification: {
        title: "Таньд мэдэгдэл ирлээ!",
        body: "Hello world",
        icon: "default",
        sound: "default",
        badge: "1",
        ...medeelel,
      },
    },
  };
  const options = {
    priority: "high",
    timeToLive: 60 * 60 * 24,
  };
  if (token)
    admin
      .messaging()
      .send(payload)
      .then((response) => {
        if (callback) callback(response);
      })
      .catch((error) => {
        next(error);
      });
  else if (callback) callback({ successCount: 1 });
}

async function khariltsagchidSonorduulgaIlgeeye(
  token,
  medeelel,
  callback,
  next
) {
  const payload = {
    token,
    // options: {
    //   priority: "high",
    //   timeToLive: 60 * 60 * 24,
    // },
    notification: {
      title: "Таньд мэдэгдэл ирлээ!",
      body: "Hello world",
      // icon: "default",
      // sound: "default",
      // badge: "1",
      ...medeelel,
    },
  };
  admin
    .messaging()
    .send(payload)
    .then((response) => {
      callback(response);
    })
    .catch((error) => {
      next(error);
    });
}

module.exports = {
  sonorduulgaIlgeeye,
  khariltsagchidSonorduulgaIlgeeye,
};
