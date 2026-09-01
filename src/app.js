const express = require("express")
const router = require("./routes/auth.routes")
const cookieParser = require("cookie-parser")
const accountRouter = require("./routes/account.routes")
const transactionRoutes = require("./routes/transaction.routes")

const app = express()


app.use(express.json())
app.use(cookieParser())

app.use("/api/auth", router)
app.use("/api/accounts", accountRouter)
app.use("/api/transaction", transactionRoutes)

module.exports = app