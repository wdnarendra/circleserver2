const AWS = require('aws-sdk')
const responseMessage = require('../config/ResponseMessage.json')
require('dotenv').config({ path: '../.env' })
setTimeout(() => {
    AWS.config.update({
        accessKeyId: process.env.accesskey,
        secretAccessKey: process.env.secretkey
    });
}, 2000)

class services {
    constructor() {
    }

    async uploadToS3(bucketname, contentType, data, path) {
        var s3 = new AWS.S3({ apiVersion: '2006-03-01' })
        var params = {
            Bucket: bucketname,
            Body: data,
            ContentType: contentType,
            Key: path,
            ACL: 'public-read'
        }
        return new Promise((resolve, reject) => {
            s3.upload(params, (error, data) => {
                if (error) {
                    reject({ Result: false, Response: responseMessage.statusMessages.uploadToS3Err })
                }
                else {
                    resolve({ Result: true, Response: data })
                }
            })
        })
    }
    async downloadFromS3(bucketname, path) {
        var s3 = new AWS.S3({ apiVersion: '2006-03-01' })
        var params = {
            Bucket: bucketname,
            Key: path
        }
        return new Promise((resolve, reject) => {
            s3.getObject(params, function (err, data) {
                if (err) {
                    reject({ "Result": false, "Response": err })
                } else {
                    resolve({ "Result": true, "Response": data })
                }
            })
        })
    }
}

module.exports = services;