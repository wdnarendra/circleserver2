const { v1: uuidv1 } = require("uuid");
const responseMessage = require("../config/ResponseMessage.json");
let dbservices = require('../modules/databaseServices')
let jwt = require('jsonwebtoken')
let s3service = require('../modules/services')
const validate = require('../requestData/requestValidation')
const validator = new validate()
let expo = require('../modules/exposervice')
const { io } = require("socket.io-client");
const socket = io("http://127.0.0.1:3000");
socket.on('error', () => { console.log('error') })
let awsservice = new s3service()
class requestdata extends dbservices {
  constructor() {
    super()
  }
  async createpostv2(body) {
    const user = body.user
    delete body.user
    delete body.jwt
    body.postId = user + '-' + uuidv1().split('-').join('')
    body.date = new Date()
    const postData = await this.readRequestData('Posts', { userName: user })
    if (!postData.length) {
      const post = await this.insertOneData('Posts', { userName: user, posts: [body] })
    } else {
      const post = await this.updateRequestData('Posts', {
        who: { userName: user }, update: {
          $push: { posts: body }
        }
      })
    }
    await this.insertOneData("Likedby", { id: body.postId, type: "person" })
    await this.insertOneData("Comment", { id: body.postId, type: "person" })
    const useruser = await this.readRequestData('Users', { userName: user })
    const userinradius = await this.mongo.collection('Users').find({ location: { $geoWithin: { $centerSphere: [useruser[0].location?.coordinates, 12 / 3963.2] } } }).toArray()
    for (let i of userinradius) {
      if (i.userName === user)
        continue
      const token = await this.readRequestData('UserSockets', { userName: i.userName })
      if (token.length && token[0].expoToken) {
        let notibody
        if (body.type == "question") {
          notibody = `${useruser[0].name} is asking a question, help him find the answer`
        }
        else if (body.type == 'announcement') {
          notibody = `${useruser[0].name} has shared an announcement with your city`
        }
        else if (body.type == 'discussion') {
          notibody = `${useruser[0].name} has started a discussion`
        }
        else {
          notibody = `${useruser[0].name} shared a post`
        }
        await expo([{
          to: token[0].expoToken,
          sound: 'default',
          body: notibody,
          data: { url: `/post/${body.id}`, postID: body.id },
        }])
      }
    }
    return { Result: true, Response: { status: "Success", user: user, body } }
  }
  async postview(body) {
    let collection, match, temp
    if (body.id.split('-').length === 2)
      body.type = 'person'
    else
      body.type = 'community'
    if (body.type === 'person') {
      collection = 'Posts'
      match = 'userName'
      temp = body.id.split('-')[0]
    }
    else {
      collection = 'CommunityPost'
      match = 'communityId'
      temp = body.id.split('-', 2).join('-')
    }
    const data = await this.mongo.collection(collection).aggregate([{ $match: { [match]: temp } }, { $unwind: '$posts' }, { $match: { 'posts.postId': body.id } }]).toArray()
    const res = await this.readRequestData('Likedby', { id: body.id })
    const comment = await this.readRequestData('Comment', { id: body.id })
    if (data.length) {
      if (body.type === 'person') {
        const details = await this.readRequestData('Users', { userName: body.id.split('-')[0] })
        data[0].details = details[0]
      }
      else {
        const details = await this.mongo.collection('Community').aggregate([{ $match: { userName: body.id.split('-')[0] } }, { $unwind: '$community' }, { $match: { 'community.communityId': body.id.split('-', 2).join('-') } }]).toArray()
        data[0].details = details[0].community
      }
      if (res.length && res[0].likedby) {
        data[0].posts.isliked = res[0].likedby.filter((value) => (value === body.user.userName)).length ? true : false
        data[0].posts.likedby = res[0].likedby.length
      }
      else {
        data[0].posts.isliked = false
        data[0].posts.likedby = 0
      }
      if (comment.length && comment[0].comments) {
        data[0].posts.totalcomment = comment[0].comments.length
      }
      else {
        data[0].posts.totalcomment = 0
      }
    }
    else { }
    return { Result: true, Response: data }
  }
  async checkuserName(body) {
    let response
    await this.readRequestData('Users', { userName: body.userName }).then(value => {
      if (value.length) {
        response = { Result: true, Response: { userName: true } }
      }
      else
        response = { Result: true, Response: { userName: false } }
    })
    return response
  }
  async firebaseToken(body) {
    let response, temp, temp2
    if (body.firebaseToken) {
      temp = 'firebaseToken'
      temp2 = body.firebaseToken
    }
    else {
      temp = 'expoToken'
      temp2 = body.expoToken
    }
    await this.readRequestData('UserSockets', { userName: body.user.userName }).then(async value => {
      if (!value.length) {
        await this.insertOneData('UserSockets', { userName: body.user.userName, [temp]: temp2 })
      }
      else {
        await this.updateRequestData('UserSockets', { who: { userName: body.user.userName }, update: { $set: { [temp]: temp2 } } })
      }
      response = { Result: true, Response: { userName: body.user.userName } }
    })
    return response
  }
  async userhomepage(body) {
    let response, limit = 5, temp
    if (body.type === 'question') temp = { 'posts.type': 'question' }
    else if (body.type === 'announcement') temp = { 'posts.type': 'announcement' }
    else if (body.type === 'discussion') temp = { 'posts.type': 'discussion' }
    else {
      temp = {}
    }
    await this.updateRequestData('Users', {
      who: { userName: body.user.userName }, update: {
        $set: {
          location: {
            type: "Point",
            coordinates: body.loc
          }
        }
      }
    })
    const value = await this.mongo.collection('Posts').aggregate([{
      $match:
        { 'posts.postLoc': { $geoWithin: { $centerSphere: [body.loc, 12 / 3963.2] } } }
    }, { $project: { userName: 1, posts: 1, _id: 1 } }, { $unwind: "$posts" }, { $match: { 'posts.postLoc': { $geoWithin: { $centerSphere: [body.loc, 12 / 3963.2] } } } }, { $match: temp },
    { $sort: { 'posts.date': -1 } }, { "$skip": (body.page - 1) * limit }, { "$limit": limit }
    ]).toArray()
    if (value.length) {
      for (let i = 0; i < value.length; i++) {
        await this.readRequestData('Likedby', { id: value[i].posts.postId }).then(value1 => {
          if (value1.length && value1[0].likedby) {
            if (value1[0].likedby.filter(value => value === body.user.userName).length)
              value[i].posts.isliked = true
            else
              value[i].posts.isliked = false
            value[i].posts.likedby = value1[0].likedby.length
          } else {
            value[i].posts.likedby = 0
            value[i].posts.isliked = false
          }
        })
      }
      for (let i = 0; i < value.length; i++) {
        await this.readRequestData('Comment', { id: value[i].posts.postId }).then(value1 => {
          if (value1.length && value1[0].comments) {
            value[i].posts.totalcomment = value1[0].comments.length
          } else
            value[i].posts.totalcomment = 0
        })
      }
      for (let i = 0; i < value.length; i++) {
        await this.readRequestData('Users', { userName: value[i].userName }).then(value1 => {
          if (value1.length) {
            value[i].profilePath = value1[0].profilePath
            value[i].name = value1[0].name
            value[i].isVerified = value1[0].isVerified
          }
        })
      }
      for (let i = 0; i < value.length; i++) {
        await this.readRequestData('Followers', { id: value[i].userName }).then(async value1 => {
          if (value1.length && value1[0].followers) {
            value[i].followers = value1[0].followers.length
            if (value1[0].followers.filter((value) => value === body.user.userName).length)
              value[i].isfollowed = true
            else
              value[i].isfollowed = false
          }
          else {
            value[i].followers = 0
            value[i].isfollowed = false
          }
        })
      }
      response = { Result: true, Response: value }
    }
    else {
      response = { Result: true, Response: [] }
    }
    return response
  }
  async getusersresultbasedonlocation(body) {
    //body.loc is a array containing long and lat
    let limit = 5
    if (!body.page) body.page = 1
    return await this.mongo.collection('Users').find({ userName: { $nin: [body.user] }, location: { $geoWithin: { $centerSphere: [body.loc, 12 / 3963.2] } } }).toArray().then(async value => {
      const temp = [], temp2 = []
      const u = await this.readRequestData('Users', { userName: body.user })
      for (let j = 0; j < value.length; j++) {
        for (let i of u[0].interest) {
          if (value[j].interest?.includes(i)) {
            temp.push(value[j])
            break
          }
        }
        temp2.push(value[j])
      }
      let t = [...temp, ...temp2]
      const start = (body.page - 1) * limit
      const end = start + limit
      t = t.slice(start, end)
      let data = t.map((value => {
        return { userName: value.userName, name: value.name, profilePath: value.profilePath, isVerified: value.isVerified, interest: value.interest }
      }))
      for (let i = 0; i < data.length; i++) {
        const te = await this.readRequestData('Followers', { id: data[i].userName })
        if (te.length && te[0].followers) {
          if (te[0].followers.filter((value) => (value === body.user)).length) {
            data[i].isfollowed = true
          }
          else
            data[i].isfollowed = false
        }
        else {
          data[i].isfollowed = false
        }
      }
      return { Result: true, Response: data }
    }).catch(error => {
      console.log(error)
      return { Result: false, Response: "error in getresultbasedonlocation api" }
    })
  }
  async getcommunityresultbasedonlocation(body) {
    //body.loc is a array containing long and lat
    if (!body.interest) body.interest = ''
    let limit = 5
    return await this.mongo.collection('Community').aggregate([{ $match: { 'community.communityLoc': { $geoWithin: { $centerSphere: [body.loc, 12 / 3963.2] } } } }, { $unwind: '$community' }, { $match: { 'community.communityLoc': { $geoWithin: { $centerSphere: [body.loc, 12 / 3963.2] } } } }, { $skip: (body.page - 1) * limit }, { $limit: limit }]).toArray().then(async value => {
      let temp = []
      value.forEach(value => {
        temp.push({ communityInterest: value.community.communityInterest, communityName: value.community.communityName, profilePath: value.community.profilePath, communityId: value.community.communityId, backgroundPath: value.community.backgroundPath })
      })
      for (let i = 0; i < temp.length; i++) {
        await this.readRequestData('Followers', { id: temp[i].communityId }).then(async value => {
          if (value.length && value[0].followers) {
            temp[i].followers = value[0].followers.length
            if (value[0].followers.filter((value) => value === body.userName).length)
              temp[i].isfollowed = true
            else
              temp[i].isfollowed = false
          }
          else {
            temp[i].followers = 0
            temp[i].isfollowed = false
          }
        })
      }
      return { Result: true, Response: temp }
    }).catch(error => {
      console.log(error)
      return { Result: false, Response: "error in getresultbasedonlocation api" }
    })
  }
  async getcommunityfollowers(body) {
    let response
    await this.readRequestData("Followers", { id: body.id }).then(value => {
      if (value.length) {
        if (value[0].followers)
          response = { Result: true, Response: value[0].followers }
        else
          response = { Result: false, Response: "error" }
      }
      else
        response = { Result: false, Response: "error" }
    })
    return response
  }
  async getinterest() {
    let response
    await this.readRequestData("Category", {}).then(value => {
      if (value[0]) {
        response = { Result: true, Response: value[0].interest }
      }
      else
        response = { Result: false, Response: responseMessage.statusMessages.noDataInDbErr }
    })
    return response
  }
  async generatejwt(body) {
    let response
    await this.readRequestData("Users", { email: body.email }).then(value => {
      if (value.length) {
        if (value[0].userName)
          response = { Result: true, Response: { jwt: jwt.sign({ userName: value[0].userName }, process.env.JSONSECRETTOKEN) } }
        else
          response = { Result: false, Response: responseMessage.statusMessages.BadRequestErr }
      }
      else
        response = { Result: false, Response: responseMessage.statusMessages.BadRequestErr }
    }).catch(error => {
      response = error
    })
    return response
  }
  async editcommunity(body) {
    let response
    const user = body.user
    delete body.jwt
    delete body.user
    let community = await this.readRequestData('Community', { userName: user.userName })
    community = community[0]
    community = community.community.filter((value) => (value.communityId === body.communityId))[0]
    body = { ...community, ...body }
    await this.updateRequestData("Community", {
      who: { userName: user.userName, "community.communityId": body.communityId }, update: {
        $set: {
          "community.$": body,
        }
      }
    }).then(value => {
      if (value.Result) {
        response = { Result: true, Response: { status: "Success", user: user.userName, data: body } }
      }
    }).catch(error => {
      response = error
    })
    return response
  }
  async createEvent(body) {
    let response
    const user = body.user
    delete body.user
    delete body.jwt
    // const u = await this.readRequestData('Events', { userName: user })
    // console.log(u)
    body.location = { type: 'Point', coordinates: body.location }
    body._id = new (require('mongodb')).ObjectId()
    if (1) {
      await this.insertOneData('Events', { userName: user, ...body })
      return { Result: true, Response: { userName: user, ...body } }
    } else
      return { Result: false, Response: 'error' }
  }
  async editdetails(body) {
    let response
    const user = body.user
    delete body.user
    delete body.jwt
    await this.updateRequestData("Users", {
      who: { userName: user.userName }, update: {
        $set: body
      }
    }).then(async value => {
      const a = await this.readRequestData('Users', { userName: user.userName })
      response = { Result: true, Response: { userdata: a[0], editedData: body } }
    }).catch(error => {
      response = error
    })
    return response
  }
  async loadcomment(body) {
    let response, data = [], limit = 5, temp
    await this.mongo.collection("Comment").aggregate([{ $match: { id: body.id, type: body.type } }, { $unwind: "$comments" }, { $skip: (body.page - 1) * limit }, { $limit: limit }]).toArray().then(async value1 => {
      if (value1.length)
        for (let i = 0; i < value1.length; i++) {
          if (value1[i].comments.type == "question") {
            temp = 'question'
          }
          else if (value1[i].comments.type == 'announcement') {
            temp = 'announcement'
          }
          else if (value1[i].comments.type == 'discussion') {
            temp = 'discussion'
          }
          else {
            temp = 'post'
          }
          if (value1[i].comments.nested?.length) {
            for (let j = 0; j < value1[i].comments.nested.length; j++) {
              const u = await this.readRequestData('Users', { userName: value1[i].comments.nested[j].userName })
              value1[i].comments.nested[j].profilePath = u[0].profilePath
              value1[i].comments.nested[j].name = u[0].name
            }
          }
          await this.readRequestData('Users', { userName: value1[i].comments.userName }).then(value => {
            let nested
            if (value1[i].comments.nested?.length) {
              nested = value1[i].comments.nested
            }
            data.push({ nested: nested, profilePath: value[0].profilePath, name: value[0].name, userName: value1[i].comments.userName, date: value1[i].comments.date, comment: value1[i].comments.comment, type: temp, commentId: value1[i].comments.commentId })
          })
        }
      response = { Result: true, Response: data }
    }).catch(error => {
      response = error
    })
    return response
  }
  async search(body) {
    let response
    await this.readRequestData("Users", { $text: { $search: body.text } }).then(value => {
      response = { Result: true, Response: { users: value } }
      return this.readRequestData("Community", { $text: { $search: body.text } })
    }).then(async value => {
      if (value.length) {
        let temp = []
        value.forEach(value => {
          value.community.forEach(value => {
            // console.log(value.communityName.match(new RegExp(body.text,'gi')))
            if (value.communityName.match(new RegExp(body.text, 'gi'))) {
              temp.push(value)
            }
            // if (value.communityName === body.text)
          })
        })
        response.Response.community = temp
      }
      else {
        response.Response.community = []
      }
    }).catch(error => {
      response = error
    })
    // console.log(response)
    return response
  }
  async userProfile(body) {
    let response, limit = 5
    let user = {}
    if (body.id) {
      user = body.id
    }
    else {
      user = body.user.userName
    }
    await this.mongo.collection("Posts").aggregate([{ $match: { userName: user } }, { $unwind: '$posts' }, { $sort: { 'posts.date': -1 } }, { $skip: (body.page - 1) * limit }, { $limit: limit }]).toArray().then(async value => {
      if (value.length) {
        for (let i = 0; i < value.length; i++) {
          await this.readRequestData('Likedby', { id: value[i].posts.postId }).then(value1 => {
            if (value1.length && value1[0].likedby) {
              if (value1[0].likedby.filter(value => value === body.user.userName).length)
                value[i].posts.isliked = true
              else
                value[i].posts.isliked = false
              value[i].posts.likedby = value1[0].likedby.length
            } else {
              value[i].posts.likedby = 0
              value[i].posts.isliked = false
            }
          })
        }
        for (let i = 0; i < value.length; i++) {
          await this.readRequestData('Comment', { id: value[i].posts.postId }).then(value1 => {
            if (value1.length && value1[0].comments) {
              value[i].posts.totalcomment = value1[0].comments.length
            } else
              value[i].posts.totalcomment = 0
          })
        }
        response = {
          Result: true, Response: {
            posts: value
          }
        }
      } else
        response = { Result: true, Response: { posts: [] } }
      return this.readRequestData("Community", { userName: user })
    }).then(value => {
      if (!value[0].community)
        response.Response.community = []
      else
        response.Response.community = value[0].community
      return this.readRequestData("Users", { userName: user })
    }).then(value => {
      response.Response.user = value[0]
      return this.readRequestData('Follows', { userName: user })
    }).then(value => {
      if (value.length) {
        if (value[0].follows)
          response.Response.userfollows = value[0].follows.length
        else
          response.Response.userfollows = 0
        if (value[0].communityFollows)
          response.Response.communityfollows = value[0].communityFollows.length
        else
          response.Response.communityfollows = 0
      }
      return this.readRequestData('Followers', { id: user })
    }).then(value => {
      if (value.length) {
        if (value[0].followers)
          response.Response.userfollowers = value[0].followers.length
        else
          response.Response.userfollowers = 0
      }
      return this.readRequestData('Follows', { userName: body.user.userName })
    }).then(value => {
      if (value.length) {
        if (value[0].follows && value[0].follows.filter((value) => value === user).length) {
          response.Response.isfollowed = true
        }
        else {
          response.Response.isfollowed = false
        }
      }
    }).catch(error => {
      response = error
    })
    return response
  }
  async communityview(body) {
    let response, limit = 5
    const user = body.user
    if (user.userName === body?.id?.split('-', 1)[0])
      await this.readRequestData("Community", { "community.communityId": body.id }).then(value => {
        value[0].community.forEach(value => {
          if (value.communityId === body.id)
            response = {
              Result: true, Response: {
                communitydata: value
              }
            }
        })
        return this.mongo.collection("CommunityPost").aggregate([{ $match: { communityId: body.id } }, { $unwind: "$posts" }, { $sort: { 'posts.date': -1 } }, { $skip: (body.page - 1) * limit }, { $limit: limit }]).toArray()
      }).then(async value => {
        if (value.length) {
          for (let i = 0; i < value.length; i++) {
            await this.readRequestData('Likedby', { id: value[i].posts.postId }).then(value2 => {
              if (value2.length && value2[0].likedby) {
                value[i].posts.likedby = value2[0].likedby.length
                if (value2[0].likedby.filter(value3 => value3 === user.userName).length) {
                  value[i].posts.isliked = true
                }
                else {
                  value[i].posts.isliked = false
                }
              }
              else {
                value[i].posts.likedby = 0
                value[i].posts.isliked = false
              }
            })
          }
          for (let i = 0; i < value.length; i++) {
            await this.readRequestData('Comment', { id: value[i].posts.postId }).then(value1 => {
              if (value1.length && value1[0].comments)
                value[i].posts.totalcomment = value1[0].comments.length
              else
                value[i].posts.totalcomment = 0
            })
          }
          value = value.map((val) => val.posts)
          response.Response.posts = value
        }
        else
          response.Response.posts = []
        return this.readRequestData('Followers', { id: body.id })
      }).then(value => {
        if (value.length) {
          if (value[0].followers) {
            if (value[0].followers.filter((value) => (value === user.userName)).length)
              response.Response.isfollowed = true
            else {
              response.Response.isfollowed = false
            }
            response.Response.followers = value[0].followers.length
          }
          else {
            response.Response.isfollowed = false
            response.Response.followers = 0
          }
        }
      })
        .catch(error => {
          response = error
        })
    else {
      await this.readRequestData("Community", { "community.communityId": body.id }).then(value => {
        let data = value[0].community.filter((value) => (value.communityId === body.id))[0]
        if (data.communityType === "public") {
          response = { Result: true, Response: { communitydata: data } }
        }
        else
          response = { Result: false, Response: responseMessage.statusMessages.BadRequestErr }
        return this.mongo.collection("CommunityPost").aggregate([{ $match: { communityId: body.id } }, { $unwind: "$posts" }, { $sort: { 'posts.date': -1 } }, { $skip: (body.page - 1) * limit }, { $limit: limit }]).toArray()
      }).then(async value => {
        if (value.length) {
          for (let i = 0; i < value.length; i++) {
            await this.readRequestData('Likedby', { id: value[i].posts.postId }).then(value2 => {
              if (value2.length && value2[0].likedby) {
                value[i].posts.likedby = value2[0].likedby.length
                if (value2[0].likedby.filter(value3 => value3 === user.userName).length) {
                  value[i].posts.isliked = true
                }
                else {
                  value[i].posts.isliked = false
                }
              }
              else {
                value[i].posts.likedby = 0
                value[i].posts.isliked = false
              }
            })
          }
          for (let i = 0; i < value.length; i++) {
            await this.readRequestData('Comment', { id: value[i].posts.postId }).then(value1 => {
              if (value1.length && value1[0].comments)
                value[i].posts.totalcomment = value1[0].comments.length
              else
                value[i].posts.totalcomment = 0
            })
          }
          value = value.map((val) => val.posts)
          response.Response.posts = value
        } else
          response.Response.posts = []
        return this.readRequestData('Followers', { id: body.id })
      }).then(value => {
        if (value[0].followers) {
          if (value[0].followers.filter((value) => (value === user.userName)).length)
            response.Response.isfollowed = true
          else {
            response.Response.isfollowed = false
          }
          response.Response.followers = value[0].followers.length
        }
        else {
          response.Response.isfollowed = false
          response.Response.followers = 0
        }
      }).catch(error => {
        response = error
      })
    }
    return response
  }
  async signupUser(body) {
    let response
    await this.readRequestData("Users", { email: body.email.toLowerCase() }).then(async value => {
      if (value.length === 0)
        await this.insertOneData("Users", { email: body.email.toLowerCase() }).then(value => {
          if (value.Result) {
            response = { Result: true, Response: { status: "Success", email: body.email, adddeatils: false } }
          }
        }).catch(error => {
          response = error
        })
      if (value.length === 1) {
        if (value[0].userName)
          response = { Result: true, Response: { status: "Success", email: body.email, adddeatils: true } }
        else
          response = { Result: true, Response: { status: "Success", email: body.email, adddeatils: false } }
      }
    })

    return response
  }
  async adddetails(body) {
    let response, profilebuffer, temp
    const collectionName = "Users"
    if (!body.profilePath.length)
      body.profilePath = "nopicture.circle"
    else {
      profilebuffer = Buffer.from(body.profilePath, "base64")
      await awsservice.uploadToS3('circlepir2', 'image/jpg', profilebuffer, `${body.userName}/${body.userName}/profile.png`).then(value => {
        if (value.Result) {
          temp = value
          body.profilePath = value.Response.Location
        }
        else {
          response = { Result: false, Response: "profilepngerror" }
        }
      }).catch(error => {
        response = { Result: false, Response: error }
      })
    }
    // if (!request.payload.backgroundPath.length)
    //   request.payload.backgroundPath = "nopicture.circle"
    // else {
    //   // backgroundbuffer = Buffer.from(request.payload.backgroundPath.data)
    //   // awsservice.uploadToS3('bucketname', 'contenttype', backgroundbuffer, 'path')
    //   request.payload.backgroundPath = "generates3dynamicpath"
    // }
    // if (temp) {
    body.userName = body.userName.trim().replace('-', '').toLowerCase()
    await this.updateRequestData(collectionName, { who: { email: body.email }, update: { $set: body } }).then(value => {
      if (value.Result) {
        response = { Result: true, Response: { status: "Success", user: body.userName } }
      }
    }).catch(error => {
      response = error
    })
    await this.readRequestData(collectionName, { email: body.email }).then(async value => {
      if (!value[0]?.flag) {
        await this.insertOneData("Follows", { userName: body.userName })
        await this.insertOneData("Followers", { id: body.userName, type: "person" })
        await this.insertOneData("Likes", { userName: body.userName })
        await this.insertOneData("Posts", { userName: body.userName })
        await this.insertOneData("Community", { userName: body.userName })
        await this.updateRequestData("Users", {
          who: { userName: body.userName }, update: {
            $set: {
              flag: true
            }
          }
        })
      }
    })
    return response
    // } else {
    //   return { Result: false, Response: 'error' }
    // }
  }
  async createcommunity(body) {
    let response, profilebuffer, backgroundbuffer, temp1, temp2
    const user = body.user
    if (user) {
      body.id = user.userName + "-" + uuidv1().split('-').join('')
      if (!body.profile.length)
        body.profile = "nopicture.circle"
      else {
        profilebuffer = Buffer.from(body.profile, "base64")
        await awsservice.uploadToS3('circlepir2', 'image/jpg', profilebuffer, `${user.userName}/${body.id}/profile.jpg`).then(value => {
          temp1 = value
          if (value.Result) {
            body.profile = value.Response.Location
          }
          else {
            response = { Result: false, Response: "profilepngerror" }
          }
        }).catch(error => {
          response = { Result: false, Response: error }
        })
      }
      if (!body.background.length)
        body.background = "nopicture.circle"
      else {
        backgroundbuffer = Buffer.from(body.background, "base64")
        await awsservice.uploadToS3('circlepir2', 'image/jpg', backgroundbuffer, `${user.userName}/${body.id}/backprofile.jpg`).then(value => {
          temp2 = value
          if (value.Result) {
            body.background = value.Response.Location
          }
          else {
            response = { Result: false, Response: "backprofilepngerror" }
          }
        }).catch(error => {
          response = { Result: false, Response: error }
        })
      }
      // if ((temp1 && temp2) || (temp1 && body.background.length) || (temp2 && body.profile.length)) {
      await this.updateRequestData("Community", { who: { userName: user.userName }, update: { $push: { community: { communityId: body.id, communityType: body.type, communityName: body.name, communityLoc: body.loc, communityInterest: body.interest, description: body.description, backgroundPath: body.background, profilePath: body.profile } } } }).then(value => {
        if (value.Result) {
          return this.insertOneData("Followers", { id: body.id, type: "community" })
        }
        else response = { Result: false, Response: responseMessage.statusMessages.noDataInDbErr }
      })
        .then(async value => {
          if (value.Result) {
            await this.updateRequestData('Follows', { who: { userName: user.userName }, update: { $push: { communityFollows: body.id } } })
            await this.updateRequestData('Followers', { who: { id: body.id }, update: { $push: { followers: user.userName } } })
            return this.insertOneData("CommunityPost", { communityId: body.id })
          }
          else
            response = { Result: false, Response: responseMessage.statusMessages.dbUpdateErr }
        }).then(value => {
          if (value.Result) {
            response = { Result: true, Response: { status: "Success", id: body.id } }
          }
          else
            response = { Result: false, Response: responseMessage.statusMessages.dbUpdateErr }
        })
        .catch(error => {
          response = error
        })
      // }
      // else {
      //   response = { Result: false, Response: responseMessage.statusMessages.dbUpdateErr }
      // }
    }
    return response
  }
  async communitypost(body) {
    // console.log(body.post)
    let response, communitypost
    const user = body.user
    if (user) {
      if (user.userName === body.id.split('-', 1)[0]) {
        body.postId = body.id + "-" + uuidv1().split('-').join('')
        // console.log(body.file.length)
        if (!body.file.length)
          body.file = "nopicture.circle"
        else {
          communitypost = Buffer.from(body.file, "base64")
          await awsservice.uploadToS3('circlepir2', 'image/jpg', communitypost, `${user.userName}/${body.id}/${body.postId}`).then(value => {
            if (value.Result) {
              body.file = value.Response.Location
            }
            else {
              response = { Result: false, Response: responseMessage.statusMessages.dbUpdateErr }
            }
          }).catch(error => {
            response = { Result: false, Response: error }
          })
        }
        await this.updateRequestData("CommunityPost", { who: { communityId: body.id }, update: { $push: { posts: { date: new Date(), post: body.post, postId: body.postId, filePath: body.file } } } }).then(value => {
          if (value.Result && value.Status.matchedCount === 1) {
            return this.insertOneData("Likedby", { id: body.postId, type: "community" })
          }
          else {
            response = { Result: false, Response: responseMessage.statusMessages.dbUpdateErr }
          }
        }).then(value => {
          if (value.Result) {
            return this.insertOneData("Comment", { id: body.postId, type: "community" })
          }
          else response = { Result: false, Response: responseMessage.statusMessages.dbUpdateErr }
        }).then(async value => {
          if (value.Result) {
            response = { Result: true, Response: { status: "Success", user: user.userName } }
            const fol = await this.readRequestData('Followers', { id: body.id })
            const c = await this.mongo.collection('Community').aggregate([{ $match: { userName: user.userName } }, { $unwind: '$community' }, { $match: { 'community.communityId': body.id } }]).toArray()
            if (fol.length && fol[0]?.followers.length) {
              for (let i = 0; i < fol[0].followers.length; i++) {
                if (fol[0].followers[i] === user.userName)
                  continue
                const token = await this.readRequestData('UserSockets', { userName: fol[0].followers[i] })
                if (token.length && token[0].expoToken) {
                  await expo([{
                    to: token[0].expoToken,
                    sound: 'default',
                    body: `${c[0].community.communityName} shared a post`,
                    data: { url: `/post/${body.id}`, postID: body.id },
                  }])
                }
              }
            }
            // const userinradius = await this.mongo.collection('Users').find({ location: { $geoWithin: { $centerSphere: [c[0].community.communityLoc.coordinates, 12 / 3963.2] } } }).toArray()
            // for (let i of userinradius) {
            //   const token = await this.readRequestData('UserSockets', { userName: i.userName })
            //   if(token.length&&token[0].expoToken)
            //   await expo([{
            //     to: token[0].expoToken,
            //     sound: 'default',
            //     body: `${c[0].community.communityName} shared a post`,
            //     data: { postID: body.id },
            //   }])
            // }
          }
          else response = { Result: false, Response: responseMessage.statusMessages.dbUpdateErr }
        }).catch(error => {
          // console.log(error)
          response = error
        })
      }
    }
    return response
  }
  async followedcommunity(userName, page = 1) {
    let limit = 5
    let response = { Result: true, Response: { posts: [] } }
    const res = await this.mongo.collection('Follows').aggregate([{ $match: { userName: userName } }, { $project: { follows: 0, _id: 0 } }, { $unwind: '$communityFollows' }, {
      $lookup:
      {
        from: "CommunityPost",
        localField: "communityFollows",
        foreignField: "communityId",
        as: "post"
      }
    }, { $unwind: '$post' }, { $unwind: '$post.posts' }, { $project: { post: '$post.posts', communityId: '$communityFollows' } }, { $sort: { 'post.date': -1 } }, { $skip: (page - 1) * limit }, { $limit: limit }]).toArray()
    // console.log(res)
    for (let i = 0; i < res.length; i++) {
      let data = await this.readRequestData('Community', { 'community.communityId': res[i].communityId }).then(value1 => {
        return value1[0].community.filter(value3 => (value3.communityId === res[i].communityId))[0]
      })
      res[i].communityName = data.communityName
      res[i].profilePath = data.profilePath
      res[i].interest = data.communityInterest
      await this.readRequestData('Likedby', { id: res[i].post.postId }).then(value2 => {
        if (value2.length && value2[0].likedby) {
          res[i].post.likedby = value2[0].likedby.length
          if (value2[0].likedby.filter(value3 => value3 === userName).length) {
            res[i].post.isliked = true
          }
          else {
            res[i].post.isliked = false
          }
        }
        else {
          res[i].post.likedby = 0
          res[i].post.isliked = false
        }
      })
      await this.readRequestData('Followers', { id: res[i].communityId }).then(value2 => {
        if (value2.length && value2[0].followers) {
          res[i].followers = value2[0].followers.length
          if (value2[0].followers.filter(value => value === userName).length) {
            res[i].isfollowed = true
          }
          else
            res[i].isfollowed = false
        }
        else {
          res[i].isfollowed = false
          res[i].followers = 0
        }
      })
      await this.readRequestData('Comment', { id: res[i].post.postId }).then(value => {
        if (value.length && value[0].comments)
          res[i].post.totalcomment = value[0].comments.length
        else
          res[i].post.totalcomment = 0
      })
    }
    if (res) {
      response.Response.posts = res
    }


    // await this.readRequestData('Follows', { userName: userName }).then(async value => {
    //   if (value[0]?.communityFollows) {
    //     let tempost = []
    //     for (let i of value[0].communityFollows) {
    //       await this.readRequestData('CommunityPost', { communityId: i }).then(async value => {
    //         if (value[0].posts) {
    //           let postsize = value[0].posts.length - 1
    //           let lastthreepost = postsize - 2
    //           for (let i = lastthreepost; i <= postsize; i++) {
    //             if (i < 0)
    //               break
    //             let data = await this.readRequestData('Community', { 'community.communityId': value[0].communityId }).then(value1 => {
    //               return value1[0].community.filter(value3 => (value3.communityId === value[0].communityId))[0]
    //             })
    //             ///aap apna gyan yaha peliye
    //             await this.readRequestData('Likedby', { id: value[0].posts[i].postId }).then(value2 => {
    //               if (value2.length && value2[0].likedby) {
    //                 value[0].posts[i].likedby = value2[0].likedby.length
    //                 if (value2[0].likedby.filter(value3 => value3 === userName).length) {
    //                   value[0].posts[i].isliked = true
    //                 }
    //                 else {
    //                   value[0].posts[i].isliked = false
    //                 }
    //               }
    //               else {
    //                 value[0].posts[i].likedby = 0
    //                 value[0].posts[i].isliked = false
    //               }
    //             })
    //             await this.readRequestData('Followers', { id: value[0].communityId }).then(value2 => {
    //               if (value2.length && value2[0].followers) {
    //                 value[0].followers = value2[0].followers.length
    //                 if (value2[0].followers.filter(value => value === userName).length) {
    //                   value[0].isfollowed = true
    //                 }
    //                 else
    //                   value[0].isfollowed = false
    //               }
    //               else {
    //                 value[0].isfollowed = false
    //                 value[0].followers = 0
    //               }
    //             })
    //             ///aap apna gyan yaha peliye
    //             tempost.push({ isfollowed: value[0].isfollowed, followers: value[0].followers, communityId: value[0].communityId, post: value[0].posts[i], communityName: data.communityName, profilePath: data.profilePath, interest: data.communityInterest })
    //           }
    //         }
    //       })
    //     }
    //     for (let i = 0; i < tempost.length; i++) {
    //       await this.readRequestData('Comment', { id: tempost[i].post.postId }).then(value => {
    //         if (value.length && value[0].comments)
    //           tempost[i].post.totalcomment = value[0].comments.length
    //         else
    //           tempost[i].post.totalcomment = 0
    //       })
    //     }
    //     for (let i = 0; i < tempost.length; i++)
    //       for (let j = 0; j < tempost.length - i - 1; j++) {
    //         if (new Date(tempost[j].post.date) > new Date(tempost[j + 1].post.date)) {
    //           let temp = tempost[j]
    //           tempost[j] = tempost[j + 1]
    //           tempost[j + 1] = temp
    //         }
    //       }
    //     response.Response.posts = tempost.reverse()
    //   }
    //   else
    //     response = { Result: true, Response: { posts: [] } }
    // })
    return response
  }
  async comment(body) {
    let response, temp
    const user = body.user
    if (user) {
      body.commentId = body.id + '-' + uuidv1().split('-').join('')
      if (body.type == "person") {
        const value = await this.readRequestData('Posts', { userName: body.id.split('-')[0] })
        temp = value[0].posts?.filter((value) => (value.postId === body.id))[0]
        temp = temp.type
      }
      if (!temp) { temp = 'post' }
      let t = 'comments', who = { id: body.id, type: body.type }
      if (body.nested === true) {
        t = 'comments.$.nested'
        who = { id: body.id, type: body.type, 'comments.commentId': body.commentid }
        const check = await this.readRequestData('Comment', { id: body.id })
        if (check[0]?.comments?.filter((value) => (value.commentId === body.commentid))[0]?.userName !== user.userName) {
          const c = await this.readRequestData('Comment', { id: body.id })
          const sendnoti = c[0].comments?.filter((value) => (value.commentId === body.commentid))[0].userName
          socket.emit('sendnotificationtouser', { userName: sendnoti, notification: { user: user.userName, commentedby: user.userName, commentId: body.commentId, postId: body.id, type: "comment", nested: true, posttype: temp } })
          const token = await this.readRequestData('UserSockets', { userName: sendnoti })
          if (token.length && token[0].expoToken)
            await expo([{
              to: token[0].expoToken,
              sound: 'default',
              body: `${user.userName} replied to your comment`,
              data: { url: `/post/${body.id}`, postID: body.id },
            }])
        }
      }
      await this.updateRequestData("Comment", { who: who, update: { $push: { [t]: { userName: user.userName, date: new Date(), comment: body.comment, commentId: body.commentId, type: temp } } } }).then(async value => {
        if (value.Result == true)
          response = { Result: true, Response: { status: "Success", res: { userName: user.userName, date: new Date(), comment: body.comment, commentId: body.commentId, type: temp } } }
        if (body.id.split('-')[0] !== user.userName) {
          socket.emit('sendnotificationtouser', { userName: body.id.split('-')[0], notification: { user: user.userName, commentedby: user.userName, commentId: body.commentId, postId: body.id, type: "comment", posttype: temp } })
          // await validator.sendnotification('dasf',
          //   {
          //     notification: {
          //       title: 'Title of your push notification',
          //       body: 'Body of your push notification'
          //     },
          //     data: {
          //       my_key: 'my value',
          //       my_another_key: 'my another value'
          //     }
          //   }
          // )
          const token = await this.readRequestData('UserSockets', { userName: body.id.split('-')[0] })
          if (token.length && token[0].expoToken)
            await expo([{
              to: token[0].expoToken,
              sound: 'default',
              body: `${user.userName} commented on your ${body.id.split('-').length > 2 ? 'community post' : 'userprofile post'}`,
              data: { url: `/post/${body.id}`, postID: body.id },
            }])
        }
      }).catch(error => {
        response = error
      })
    }
    return response
  }
  async post(body) {
    let response, postbuffer, temp
    const user = body.user
    if (user) {
      body.postId = user.userName + "-" + uuidv1().split('-').join('')
      if (body.filePath.length === 0)
        body.filePath = "nopicture.circle"
      else {
        postbuffer = Buffer.from(body.filePath, 'base64')
        await awsservice.uploadToS3('circlepir2', 'image/jpg', postbuffer, `${body.user.userName} / ${body.user.userName} / ${body.postId}`).then(value => {
          body.filePath = value.Response.Location
        }).catch(error => {
          response = { Result: false, Response: error }
        })
      }
      if (body.type == "question") {
        temp = 'question'
      }
      else if (body.type == 'announcement') {
        temp = 'announcement'
      }
      else if (body.type == 'discussion') {
        temp = 'discussion'
      }
      else {
        temp = 'post'
      }
      await this.updateRequestData("Posts", { who: { userName: user.userName }, update: { $push: { posts: { date: new Date(), post: body.post, postId: body.postId, postLoc: body.postLoc, postInterest: body.postInterest, filePath: body.filePath, type: temp } } } }).then(value => {
        if (value.Result) {
          return this.insertOneData("Likedby", { id: body.postId, type: "person" })
        }
        else
          response = { Result: false, Response: responseMessage.statusMessages.dbUpdateErr }
      })
        .then(value => {
          if (value.Result) {
            return this.insertOneData("Comment", { id: body.postId, type: "person" })
          }
          else
            response = { Result: false, Response: responseMessage.statusMessages.dbUpdateErr }
        }).then(async value => {
          if (value.Result) {
            response = { Result: true, Response: { status: "Success", user: user.userName } }
            const useruser = await this.readRequestData('Users', { userName: user.userName })
            const userinradius = await this.mongo.collection('Users').find({ location: { $geoWithin: { $centerSphere: [useruser[0].location?.coordinates, 12 / 3963.2] } } }).toArray()
            for (let i of userinradius) {
              if (i.userName === user.userName)
                continue
              const token = await this.readRequestData('UserSockets', { userName: i.userName })
              if (token.length && token[0].expoToken) {
                let notibody
                if (body.type == "question") {
                  notibody = `${useruser[0].name} is asking a question, help him find the answer`
                }
                else if (body.type == 'announcement') {
                  notibody = `${useruser[0].name} has shared an announcement with your city`
                }
                else if (body.type == 'discussion') {
                  notibody = `${useruser[0].name} has started a discussion`
                }
                else {
                  notibody = `${useruser[0].name} shared a post`
                }
                await expo([{
                  to: token[0].expoToken,
                  sound: 'default',
                  body: notibody,
                  data: { url: `/post/${body.id}`, postID: body.id },
                }])
              }
            }
          }
          else
            response = { Result: false, Response: responseMessage.statusMessages.dbUpdateErr }
        }).catch(err => {
          response = err
        })
    }
    else {
      response = { Result: false, Response: responseMessage.statusMessages.dbUpdateErr }
    }
    return response
  }
  async getfollows(userName) {
    return this.readRequestData('Follows', { userName: userName }).then(async value => {
      if (value.length) {
        let data = []
        for (let i = 0; i < value[0].communityFollows.length; i++) {
          await this.readRequestData('Community', { "community.communityId": value[0].communityFollows[i] }).then(value1 => {
            let temp = value1[0].community.filter((value2) => (value2.communityId === value[0].communityFollows[i]))[0]
            data.push({ communityName: temp.communityName, profilePath: temp.profilePath, communityId: temp.communityId })
          })
        }
        let data2 = []
        for (let i = 0; i < value[0].follows.length; i++) {
          await this.readRequestData('Users', { userName: value[0].follows[i] }).then(value1 => {
            data2.push({ userName: value1[0].userName, profilePath: value1[0].profilePath, name: value1[0].name })
          })
        }
        return { Result: true, Response: { communityfollows: data, userfollows: data2 } }
      }
      return { Result: false, Response: 'error' }
    }).catch(error => {
      return { Result: false, Response: 'error in getfollows api' }
    })
  }
  async getfollowers(userName) {
    return this.readRequestData('Followers', { id: userName }).then(async value => {
      if (value.length) {
        let data = []
        for (let i = 0; i < value[0].followers.length; i++) {
          await this.readRequestData('Users', { userName: value[0].followers[i] }).then(value => {
            data.push({ userName: value[0].userName, name: value[0].name, profilePath: value[0].profilePath })
          })
        }
        return { Result: true, Response: { userfollowers: data } }
      }
      return { Result: false, Response: 'error' }
    }).catch(error => {
      return { Result: false, Response: 'error in getfollows api' }
    })
  }
  async follow(body) {
    let response, err
    const user = body.user
    if (user) {
      let type, collection, find
      if (body.type == "person") {
        type = "follows"
        collection = "Users"
        find = { userName: body.id }
      }
      if (body.type == "community") {
        type = "communityFollows"
        collection = "Community"
        find = { userName: body.id.split('-', 1)[0], "community.communityId": body.id }
      }
      await this.readRequestData(collection, find).then(value => {
        if (value.length === 1) {
          return this.readRequestData("Follows", { userName: user.userName, [type]: body.id })
        }
        else response = { Result: false, Response: responseMessage.statusMessages.noDataInDbErr }
      }).then(value => {
        if (value.length === 0) {
          return this.updateRequestData("Follows", { who: { userName: user.userName }, update: { $push: { [type]: body.id } } })
        }
        else response = { Result: false, Response: responseMessage.statusMessages.noDataInDbErr }
      }).then(value => {
        if (value.Result) {
          response = { Result: true, Response: { status: "Success", user: user.userName } }
          return this.updateRequestData("Followers", { who: { id: body.id }, update: { $push: { followers: user.userName } } })
        }
      }).then(async value => {
        if (value.Result) {
          response = { Result: true, Response: { status: "Success", user: body.user } }
          if (body.id.split('-')[0] !== user.userName) {
            socket.emit('sendnotificationtouser', { userName: body.id.split('-')[0], notification: { user: user.userName, followedby: user.userName, id: body.id, type: "follow" } })
            // await validator.sendnotification('dasf',
            //   {
            //     notification: {
            //       title: 'Title of your push notification',
            //       body: 'Body of your push notification'
            //     },
            //     data: {
            //       my_key: 'my value',
            //       my_another_key: 'my another value'
            //     }
            //   }
            // )
            const token = await this.readRequestData('UserSockets', { userName: body.id.split('-')[0] })
            if (token.length && token[0].expoToken)
              await expo([{
                to: token[0].expoToken,
                sound: 'default',
                body: `${user.userName} started following ${body.id.split('-').length > 1 ? 'your community' : 'you'}`,
                data: { url: `/user/${user.userName}`, postID: body.id },
              }])
          }
        }
      }).catch(error => {
        err = error
      })
    }
    if (!err)
      return response
    else return err
  }
  async likes(body) {
    let response
    const user = body.user
    if (user) {
      let type, collection, option, id
      if (body.type == "person") {
        id = body.id.split("-", 1)[0]
        type = "personLikes"
        option = "userName"
        collection = "Posts"
      }
      if (body.type == "community") {
        let communityid = body.id.split('-', 2)
        id = communityid[0] + '-' + communityid[1]
        type = "communityLikes"
        collection = "CommunityPost"
        option = "communityId"
      }
      let tem
      await this.readRequestData(collection, { [option]: id, "posts.postId": body.id }).then(value => {
        if (value.length === 1) {
          if (body.type == "person") {
            tem = value[0].posts.filter((value) => (value.postId === body.id))[0]
            tem = tem.type
          }
          return this.readRequestData("Likes", { userName: user.userName, [type]: body.id })
        }
        else response = { Result: false, Response: responseMessage.statusMessages.noDataFoundErr }
      }).then(value => {
        if (value.length === 0) {
          return this.updateRequestData("Likes", { who: { userName: user.userName }, update: { $push: { [type]: body.id } } })
        }
        else response = { Result: false, Response: responseMessage.statusMessages.noDataFoundErr }
      })
        .then(value => {
          if (value.Result) {
            response = { Result: true, Response: { status: "Success", user: user.userName } }
            return this.updateRequestData("Likedby", { who: { id: body.id }, update: { $push: { likedby: user.userName } } })
          }
          else response = { Result: false, Response: responseMessage.statusMessages.noDataFoundErr }
        }).then(async value => {
          if (value.Result) {
            response = { Result: true, Response: { status: "Success", user: user.userName } }
            if (body.id.split('-')[0] !== user.userName) {
              socket.emit('sendnotificationtouser', { userName: body.id.split('-')[0], notification: { user: user.userName, likedby: user.userName, postId: body.id, type: "like", posttype: tem ? tem : 'post' } })
              // await validator.sendnotification('dasf',
              //   {
              //     notification: {
              //       title: 'Title of your push notification',
              //       body: 'Body of your push notification'
              //     },
              //     data: {
              //       my_key: 'my value',
              //       my_another_key: 'my another value'
              //     }
              //   }
              // )
              const token = await this.readRequestData('UserSockets', { userName: body.id.split('-')[0] })
              if (token.length && token[0].expoToken)
                await expo([{
                  to: token[0].expoToken,
                  sound: 'default',
                  body: `${user.userName} liked your ${body.id.split('-').length > 2 ? 'community post' : 'post'}`,
                  data: { url: `/post/${body.id}`, postID: body.id },
                }])
            }
          }
          else response = { Result: false, Response: responseMessage.statusMessages.noDataFoundErr }
        }).catch(err => {
          response = err
        })
    }
    return response
  }
}

module.exports = requestdata;
