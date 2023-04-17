const { v1: uuidv1 } = require("uuid");
let validate = require('./requestData/requestValidation')
let validator = new validate()
const fetchdata = require("./requestData/fetchData.js");
let appdata = new fetchdata();
const responseMessage = require("./config/ResponseMessage.json");
const express = require('express')
let firebase = require('./modules/firebaseservice')
const app = express()
const body = require('body-parser')
const cors = require('cors')
const razorpay = require('./utils/razorpay')
require('dotenv').config()
appdata.connectToDb()
app.use(body.json({ limit: '500mb' }), cors())
const upload = require('./middleware/upload')
app.post('/upload', upload.array('file'), (req, res, next) => {
  try {
    if (req.files) {
      res.json({ status: true, data: req.files })
    }
    else {
      res.json({ status: false })
    }
  } catch (error) {
    // console.log(error)
    res.json({
      status: false
    })
  }
})
app.post('/api', async (req, res) => {
  try {
    let request = req.body
    let uniqueId = uuidv1()
    async function generatecode(funcvalidate, validatetoken, funcappdata) {
      if (funcvalidate(request.payload).Result) {
        const response = validatetoken(request.payload.jwt)
        if (response.Result) {
          request.payload.user = response.Response
          appdata.genearatecode = funcappdata//this thing is most important thing because appdata method has this.methods which does not execute if we does not use appdata instance and after assigning a new variable to appdata.method the new variable does know how to represent this keyword in the method that why it is important
          const result = await appdata.genearatecode(request.payload, appdata)
          if (result?.Result) {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Ok, result.Response)))
          }
          else {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, "error")))
          }
        }
        else {
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, 'jwt not verified')))
        }
      }
      else
        res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, responseMessage.statusMessages.BadRequestErr)))
    }
    switch (request.operationName.toLowerCase()) {
      case 'editcomment':
        const decodedtokennedit = validator.validatejwt(req.body.payload.jwt)
        if (decodedtokennedit.Result) {
          const body = req.body.payload
          await appdata.updateRequestData('Comment', { who: { id: body.id, 'comments.commentId': body.commentId }, update: { $set: { 'comments.$.comment': body.comment } } })
          res.json({ status: true })
        }
        break
      case "unlike":
        const decodedtokennunlike = validator.validatejwt(req.body.payload.jwt)
        if (decodedtokennunlike.Result) {
          const body = req.body.payload
          let temp
          if (body.type === 'person') {
            temp = 'personLikes'
          }
          else
            temp = 'communityLikes'
          await appdata.updateRequestData('Follows', { who: { userName: decodedtokennunlike.Response.userName }, update: { $pull: { [temp]: body.id } } })
          await appdata.updateRequestData('Followers', { who: { id: body.id }, update: { $pull: { followers: decodedtokennunlike.Response.userName } } })
          res.json({ status: true })
        }
        break
      case "unfollow":
        const decodedtokenn = validator.validatejwt(req.body.payload.jwt)
        if (decodedtokenn.Result) {
          const body = req.body.payload
          let temp
          if (body.type === 'person') {
            temp = 'follows'
          }
          else
            temp = 'communityFollows'
          await appdata.updateRequestData('Follows', { who: { userName: decodedtokenn.Response.userName }, update: { $pull: { [temp]: body.id } } })
          await appdata.updateRequestData('Followers', { who: { id: body.id }, update: { $pull: { followers: decodedtokenn.Response.userName } } })
          res.json({ status: true })
        }
        break
      case "bookevent":
        const orderbody = req.body.payload
        const amount = await appdata.readRequestData('Events', { _id: require('mongodb').ObjectId(orderbody.id) })
        const order = await razorpay.orders.create({
          currency: 'INR',
          amount: amount[0]?.amount * 100,
          receipt: orderbody.id
        })
        res.json({ status: true, data: order })
        break
      case "getcategories":
        res.json({ status: true, response: await appdata.readRequestData('Categories', {}) })
        break
      case "createpostv2":
        const decodedToken = await validator.validatejwt(req.body.payload.jwt)
        if (decodedToken.Result) {
          req.body.payload.user = decodedToken.Response.userName
          let temp1131 = await appdata.createpostv2(req.body.payload)
          if (temp1131.Result) {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Accepted, temp1131.Response)))
          }
          else {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
          }
        } else {
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
        }
        break
      case "readevent":
        if (!req.body?.payload?.criteria) {
          req.body.payload.criteria = {}
        }
        let eventdata = await appdata.readRequestData('Events', req.body.payload.criteria)
        eventdata = eventdata.filter((value) => (new Date(value.date) >= new Date()))
        res.json({ status: true, data: eventdata })
        break
      case "createevent":
        const jj = await validator.validatejwt(req.body.payload.jwt)
        if (jj.Result) {
          req.body.payload.user = jj.Response.userName
          let temp113 = await appdata.createEvent(req.body.payload)
          if (temp113.Result) {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Accepted, temp113.Response)))
          }
          else {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
          }
        } else {
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
        }
        break
      case "postview":
        const checktoken = await validator.validatejwt(req.body.payload.jwt)
        if (checktoken.Result) {
          req.body.payload.user = checktoken.Response
          let temp113 = await appdata.postview(req.body.payload)
          if (temp113.Result) {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Accepted, temp113.Response)))
          }
          else {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
          }
        } else {
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
        }
        break
      case "isuserunique":
        let temp11 = await appdata.checkuserName(req.body.payload)
        if (temp11.Result) {
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Accepted, temp11.Response)))
        }
        else {
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
        }
        break
      case "firebasetoken":
        if (validator.validatejwt(req.body.payload.jwt).Result) {
          req.body.payload.user = validator.validatejwt(req.body.payload.jwt).Response
          let temp = await appdata.firebaseToken(req.body.payload)
          if (temp.Result) {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Accepted, temp.Response)))
          }
          else {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
          }
        }
        else {
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
        }
        break
      case "userhomepage":
        if (validator.validatejwt(req.body.payload.jwt).Result) {
          req.body.payload.user = validator.validatejwt(req.body.payload.jwt).Response
          let temp = await appdata.userhomepage(req.body.payload)
          if (temp.Result) {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Accepted, temp.Response)))
          }
          else {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
          }
        }
        else {
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
        }
        break
      case "getcommunityresultbasedonlocation":
        if (validator.validatejwt(req.body.payload.jwt).Result) {
          req.body.payload.userName = validator.validatejwt(req.body.payload.jwt).Response.userName
          let temp = await appdata.getcommunityresultbasedonlocation(req.body.payload)
          // console.log(temp)
          if (temp.Result) {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Accepted, temp.Response)))
          }
          else {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
          }
        }
        else {
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
        }
        break
      case "getusersresultbasedonlocation":
        if (validator.validatejwt(req.body.payload.jwt).Result) {
          req.body.payload.user = validator.validatejwt(req.body.payload.jwt).Response.userName
          let temp = await appdata.getusersresultbasedonlocation(req.body.payload)
          if (temp.Result) {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Accepted, temp.Response)))
          }
          else {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
          }
        }
        else {
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
        }
        break
      case "getcommunityfollowers":
        let something = validator.validatejwt(req.body.payload.jwt)
        if (something.Result) {
          let temp = await appdata.getcommunityfollowers(req.body.payload)
          if (temp.Result) {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Accepted, temp.Response)))
          }
          else {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
          }
        }
        else {
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
        }

        break
      case "getfollows":
        let temp3 = validator.validatejwt(req.body.payload.jwt)
        if (temp3.Result) {
          if (req.body.payload.id) {
            temp3.Response.userName = req.body.payload.id
          }
          let temp = await appdata.getfollows(temp3.Response.userName)
          if (temp.Result) {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Accepted, temp.Response)))
          }
          else {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
          }
        }
        else {
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
        }
        break
      case "getfollowers":
        let temp4 = validator.validatejwt(req.body.payload.jwt)
        if (temp4.Result) {
          if (req.body.payload.id) {
            temp4.Response.userName = req.body.payload.id
          }
          let temp = await appdata.getfollowers(temp4.Response.userName)
          if (temp.Result) {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Accepted, temp.Response)))
          }
          else {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
          }
        }
        else {
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
        }
        break
      case "getinterest":
        let temp = await appdata.getinterest()
        if (temp.Result) {
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Accepted, temp.Response)))
        }
        else {
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
        }
        break
      case "homepage":
        let result = validator.validatejwt(req.body.payload.jwt)
        if (result.Result) {
          let user = result.Response
          let result2 = await appdata.followedcommunity(user.userName, req.body.payload.page)
          if (result2.Result) {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Accepted, result2.Response)))
          }
          else {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.Forbidden, false)))
          }
        }
        else {
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
        }
        break
      case "checkuser":
        if (req.body.payload.email) {
          await firebase.getUserByEmail(req.body.payload.email).then(value => {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Accepted, true)))
          }).catch(error => {
            // console.log(error)
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, false)))
          })
        }
        break
      case "userprofile":
        generatecode(validator.userProfile, validator.validatejwt, appdata.userProfile)
        break
      case "communityview":
        generatecode(validator.communityview, validator.validatejwt, appdata.communityview)
        break
      case "comment":
        generatecode(validator.comment, validator.validatejwt, appdata.comment)
        break
      case "follow":
        generatecode(validator.follow, validator.validatejwt, appdata.follow)
        break
      case "likes":
        generatecode(validator.likes, validator.validatejwt, appdata.likes)
        break
      case "loadcomment":
        generatecode(validator.loadcomment, validator.validatejwt, appdata.loadcomment)
        break
      case "editdetails":
        generatecode(validator.editdetails, validator.validatejwt, appdata.editdetails)
        break
      case "search":
        generatecode(validator.search, validator.validatejwt, appdata.search)
        break
      case "post":
        generatecode(validator.post, validator.validatejwt, appdata.post)
        break
      case "createcommunity":
        generatecode(validator.createcommunity, validator.validatejwt, appdata.createcommunity)
        break
      case "communitypost":
        generatecode(validator.communitypost, validator.validatejwt, appdata.communitypost)
        break
      case "signup":
        if (validator.signup(request.payload).Result === true) {
          const result = await appdata.signupUser(request.payload)
          // console.log(result)
          if (result.Result === true) {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Ok, result.Response)))
          }
          else {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, result.Response)))
          }
        }
        else
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, responseMessage.statusMessages.BadRequestErr)))
        break
      case "adddetails":
        if (validator.adddetails(request.payload).Result === true) {
          const response = await validator.validatefirebasetoken(request.payload.token)
          if (response.Result === true) {
            request.payload.isVerified = false
            request.payload.email = response.Response
            delete request.payload.token
            const result = await appdata.adddetails(request.payload)
            if (result.Result === true) {
              res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Ok, result.Response)))
              // res.send(JSON.stringify({ status: 200, jwt: jwt.sign({ userName: request.payload.userName }, process.env.JSONSECRETTOKEN) }))
            }
            else {
              res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, result.Response)))
            }
          }
          else {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, responseMessage.statusMessages.BadRequestErr)))
          }
        }
        else
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, responseMessage.statusMessages.BadRequestErr)))
        break
      case "generatejwt":
        if (validator.generatejwt(request.payload)) {
          const response = await validator.validatefirebasetoken(request.payload.token)
          if (response.Result) {
            request.payload.email = response.Response
            const result = await appdata.generatejwt(request.payload)
            // console.log(result)
            if (result.Result)
              res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Success, responseMessage.statusCode.Accepted, result.Response)))
            else {
              res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, "wrong token request")))
            }
          }
          else {
            res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, "wrong token request")))
          }
        }
        else
          res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest, "bad request")))
        break
      case "editcommunity":
        generatecode(validator.editcommunity, validator.validatejwt, appdata.editcommunity)
        break
      default:
        res.send(JSON.stringify(finalResponse(uniqueId, responseMessage.status.Failed, responseMessage.statusCode.BadRequest)))
    }
  }
  catch (error) {
    console.log(error)
    res.send(JSON.stringify(finalResponse("errorcodecacheerror", responseMessage.status.Failed, responseMessage.statusCode.BadRequest)))
  }
})
function finalResponse(id, statmsg, statcode, res) {
  var finalRes = {
    statusCode: statcode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "OPTIONS,POST"
    },
    body: {
      refId: id,
      status: statmsg,
      statusCode: statcode,
      response: res
    }
  }
  return finalRes;
}

app.listen(8080)