const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = "mongodb+srv://hicircleconnect:MoGQb4T528xZo6RA@circlemongodbcluster.y38k0px.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
const responseMessage = require("../config/ResponseMessage.json");
class databaseClass {
  constructor() {
  }

  async connectToDb() {
    try {
      await client.connect();
      this.database = await client.db("circle")
    } catch (error) {
      console.log(error);
    }
  }
  get mongo(){
    return this.database
  }
  async insertOneData(collection, params) {
    let response, err
    await this.findCollection(collection).insertOne(params).then(value => {
      if (value.acknowledged == true)
        response = { Result: true, Response: "item inserted successfully" };
    }).catch(error => {
      console.log(error);
      err = { Result: false, Response: responseMessage.statusMessages.insertFailErr };
    })
    return new Promise((resolve, reject) => {
      if (!err) {
        resolve(response);
      } else {
        reject(err);
      }
    });
  }

  async insertManyData(collection, params) {
    let response, err
    await this.findCollection(collection).insertMany(params).then(value => {
      if (value.acknowledged == true)
        response = { Result: true, Response: "items inserted successfully" }
    }).catch(error => {
      console.log(error);
      err = { Result: false, Response: responseMessage.statusMessages.insertFailErr };
    })
    return new Promise((resolve, reject) => {
      if (!err) {
        resolve(response);
      } else {
        reject(err);
      }
    });
  }

  async readRequestData(collection, params) {
    let response = [];
    let err;
    try {
      await this.findCollection(collection).find(params).forEach((somes) => {
        response.push(somes);
      });
    } catch (error) {
      console.log(error+'inside the databaseservices')
      err = { Result: false, Response: responseMessage.statusMessages.noDataFoundErr };
    }
    return new Promise((resolve, reject) => {
      if (!err) {
        resolve(response);
      } else {
        reject(err);
      }
    });
  }

  async updateRequestData(collection, params) {
    let response, err
    await this.findCollection(collection).updateMany(
      params.who,
      params.update
    ).then(value => {
      if (value.acknowledged)
        response = { Result: true, Response: "items updated successfully", Status: value }
    }).catch(error => {
      console.log(error)
      err = { Result: false, Response: responseMessage.statusMessages.dbUpdateErr }
    })
    return new Promise((resolve, reject) => {
      if (!err) resolve(response);
      else reject(err);
    });
  }

  async deleteRequestData(collection, params) {
    let response, err;
    try {
      response = await this.findCollection(collection).deleteMany(params);
    } catch (error) {
      err = error;
      err = {Result:false,Response:responseMessage.statusMessages.dbUpdateErr}
    }
    return new Promise((resolve, reject) => {
      if (!err) resolve(response);
      else reject(err);
    });
  }
  findCollection(table) {
    return this.database.collection(table);
  }
}
module.exports = databaseClass;
