const multer = require('multer')
const multers3 = require('multer-s3')
const { v4: uuid } = require('uuid')
const { S3Client } = require('@aws-sdk/client-s3')

const s3 = new S3Client({
    credentials: {
        accessKeyId: process.env.accesskey,
        secretAccessKey: process.env.secretkey
    },
    region:'ap-south-1'
})
const upload = multer({
    storage: multers3({
        s3: s3,
        bucket: 'circlepir2',
        acl: 'public-read',
        key: (req, file, cb) => {
            cb(null, uuid().split('-').join() + file.originalname)
        }
    })
})

module.exports = upload