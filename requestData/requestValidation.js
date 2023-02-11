let responseMessage = require('../config/ResponseMessage.json')
let jwt = require('jsonwebtoken')
let auth = require('../modules/firebaseservice')
require('dotenv').config({ path: '../.env' })
class validate {
    constructor() { }
    validatejwt(token) {
        let response
        try {
            response = { Result: true, Response: jwt.verify(token, process.env.JSONSECRETTOKEN) }
        }
        catch {
            response = { Result: false, Response: responseMessage.statusMessages.BadRequestErr }
        }
        return response
    }
    async sendnotification(token, messagepayload) {
        return await fcm.sendToDevice(token, messagepayload)
    }
    async validatefirebasetoken(token) {
        // console.log(token)
        let response
        await auth.verifyIdToken(token).then(token => {
            // console.log(token)
            // response={Result:true,Response:token.phone_number.slice(3)}
            response = { Result: true, Response: token.email }
        }).catch(error => {
            // console.log(error)
            response = { Result: false, Response: responseMessage.statusMessages.BadRequestErr }
        })
        // console.log(response)
        return response

    }
    editdetails(payload) {
        return { Result: true }
    }
    loadcomment(payload) {
        return { Result: true }
    }
    search(payload) {
        return { Result: true }
    }
    userProfile(payload) {
        return { Result: true }
    }
    communityview(payload) {
        //first input validation
        return { Result: true }
    }
    editcommunity(payload) {
        if (payload);
        return { Result: true }
    }
    signup(payload) {
        return { Result: true }
        let mobileNumber = payload.mobileNumber + ""
        if (mobileNumber.length === 10 && mobileNumber[0] === "6" | "7" | "8" | "9") {
            return { Result: true }
        }
        else
            return { Result: false, Response: responseMessage.statusMessages.BadRequestErr }
    }
    adddetails(payload) {
        return { Result: true }
        if (payload.token && payload.userName && payload.location && payload.gender && payload.interest && payload.name && payload.profilePath && payload.backgroundPath) {   //other regex checking code goes here
            return { Result: true }
        }
        else {
            return { Result: false, Response: responseMessage.statusMessages.BadRequestErr }
        }
    }
    post(payload) {
        return { Result: true }
        if (payload.jwt && payload.post && payload.postLoc && payload.filePath && payload.postInterest) {   //other regex checking code goes here
        }
        else {
            return { Result: false, Response: responseMessage.statusMessages.BadRequestErr }
        }
    }
    generatejwt(payload) {
        if (payload.token) {
            return { Result: true }
        }
        else
            return { Result: false }
    }
    comment(payload) {
        if (payload.jwt && payload.type && payload.comment && payload.id) {
            //other regex checking code goes here
            return { Result: true }
        }
        else
            return { Result: false, Response: responseMessage.statusMessages.BadRequestErr }
    }
    follow(payload) {
        if (payload.jwt && payload.id && payload.type) {   //other regex checking code goes here
            return { Result: true }
        }
        else {
            return { Result: false, Response: responseMessage.statusMessages.BadRequestErr }
        }
    }
    likes(payload) {
        if (payload.jwt && payload.id && payload.type) {   //other regex checking code goes here
            return { Result: true }
        }
        else {
            return { Result: false, Response: responseMessage.statusMessages.BadRequestErr }
        }
    }
    createcommunity(payload) {
        if (payload.jwt && payload.name && payload.type && payload.interest && payload.loc && payload.profile != undefined && payload.background != undefined && payload.description) {   //other regex checking code goes here
            return { Result: true }
        }
        else {
            return { Result: false, Response: responseMessage.statusMessages.BadRequestErr }
        }
    }
    communitypost(payload) {
        return { Result: true }
        if (payload.jwt && payload.id && payload.post && payload.file != undefined) {   //other regex checking code goes here
        }
        else {
            return { Result: false, Response: responseMessage.statusMessages.BadRequestErr }
        }
    }
}
module.exports = validate