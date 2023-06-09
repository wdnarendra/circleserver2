const { Expo } = require('expo-server-sdk')
require('dotenv').config('../.env')
let expo = new Expo({ accessToken: process.env.expoToken })

module.exports = async (msg) => {
    return await expo.sendPushNotificationsAsync(msg)
}