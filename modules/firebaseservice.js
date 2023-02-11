
let admin = require("firebase-admin");

let serviceAccount = require("../path/to/serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports=admin.auth()
// module.exports.fcm=admin.messaging()