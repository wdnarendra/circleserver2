// # import requests
// # f = open('C:/Users/Narendra/Desktop/databaseschema.png','r',5,'encoding='base64')
// # test={
// #     "operationName":"post",
// #     "payload":{
// #         "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlck5hbWUiOiJjb29sYm95IiwiaWF0IjoxNTE2MjM5MDIyfQ.aMyRq7HTtmBGqAOLslOy8syfcH8Fpsh4cfs8OJLgXTA",
// #         "post": "this is first post",
// #          "postLoc": {
// #             "type": "Point",
// #             "coordinates": [
// #                 5,
// #                 6
// #             ]
// #         },
// #         "filePath": f.read(),
// #         "postInterest": [
// #             "badminton",
// #             "other"
// #         ]
// #     }}
// # requests.post('http://127.0.0.1:80/api',json=test)

            
let axios = require('axios')
let fs = require('fs')

async function code(){
    let file =  fs.readFileSync('C:/Users/Narendra/Downloads/IMG_20220829_102610.jpg',{encoding:'base64'},(err)=>{})
    let sendingdata ={
            "operationName":"communitypost",
            "payload":{
                "jwt": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwidXNlck5hbWUiOiJNdXNpY19zaW5naCIsImlhdCI6MTUxNjIzOTAyMn0.iC6xc7_LJVPi85kIZoezRhm8Wcwx34y3tAi4KMFbwPg",
                "id": "Music_singh-320e654189ba11ed8c9333054422176e",
                "post": "this is first communitypost",
                "file":file
            }
        }
    let customConfig = {
            headers: {
            'Content-Type': 'application/json'
            }}
    axios.post('http://ec2-35-77-103-137.ap-northeast-1.compute.amazonaws.com:80/api',JSON.stringify(sendingdata),customConfig).then(value=>{
        console.log(JSON.stringify(value.data))
    })
}
code()
