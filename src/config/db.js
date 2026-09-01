const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const mongoose = require("mongoose")


function connectDB(){
    mongoose.connect(process.env.MONGO_URI)
    .then(()=>{
        console.log("server is connected to DB")
    })

    .catch(err=>{
        console.log("Error connecting to DB")
        process.exit(1)
    })
}


module.exports = connectDB