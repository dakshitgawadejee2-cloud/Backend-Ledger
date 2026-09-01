const transactionModel = require("../models/transaction.model")
const ledgerModel = require("../models/ledger.model")
const accountModel = require("../models/account.model")
const emailService = require("../service/email.service")
const mongoose = require("mongoose")


async function createTransaction(req,res){

    const { fromAccount , toAccount , amount , idempotencykey } = req.body

    if(!fromAccount || !toAccount || !amount || !idempotencykey){
         return res.status(400).json({
               message:"FromAccount, toAccount ,amount and idempotencykey are required"
        })
    }

    const fromUserAccount = await accountModel.findOne({
        _id: fromAccount,
    })

    const toUserAccount = await accountModel.findOne({
        _id: toAccount,
    })


    if(!fromUserAccount || !toUserAccount){
        return res.status(400).json({
            message:"Invalid fromAccount or toAccount"
        })
    }


    const isTransactionAlreadyExists = await transactionModel.findOne({
        idempotencykey: idempotencykey
    })

    if(isTransactionAlreadyExists){
        if(isTransactionAlreadyExists.status == "COMPLETED"){
           return res.status(200).json({
                message: "Transaction already processed",
                transaction: isTransactionAlreadyExists
            })
        }

        if(isTransactionAlreadyExists.status == "PENDING"){
           return  res.status(200).json({
                message:"Transtion is still processing",
            })
        }

        if(isTransactionAlreadyExists.status == "FAILED" ){
          return  res.status(500).json({
                message:"Transaction processing failed, please retry"
            })
        }

        if(isTransactionAlreadyExists.status == "REVERSD"){
           return res.status(500).json({
                 message:"Transaction was reversed, please retry"
            })
        }
    }
    

    if(fromUserAccount.status!=="ACTIVE" || toUserAccount.status !=="ACTIVE"){

        return res.status(400).json({
            message:"Both fromAccount and toAccount must be Active to process transaction"
        })

    }


    const balance = await fromUserAccount.getBalance()

    if(balance<amount){
       return res.status(400).json({
            message:`Insufficient balance. Current balance is ${balance}. Requested amount is ${amount}`
        })
    }


    const session = await mongoose.startSession()
    session.startTransaction()

    const transaction = await transactionModel.create({
        fromAccount,
        toAccount,
        amount,
        idempotencykey,
        srtatus:"PENDING"
    }, { session })

    const debitLedgerEntry = await ledgerModel.create({
        account: fromAccount,
        amount: amount,
        transaction: transaction._id,
        type: "DEBIT"
    },{ session })

    const creditLedgerEntry = await ledgerModel.create({
        account: toAccount,
        amount: amount,
        transaction: transaction._id,
        type:"CREDIT"
    },{ session })

    transaction.status = "COMPLETED"

    await transaction.save({ session })



    await session.commitTransaction()
    session.endSession()


    await emailService.sendTransactionEmail(req.user.email,req.user.name, amount ,toAccount)

    return res.status(201).json({
        message:"Transaction completed successfully",
        transaction:transaction
    })

}


 async function createInitialFundsTransaction(req, res) {
    const { toAccount, amount, idempotencykey } = req.body;

    // 1. Validate request body fields first
    if (!toAccount || !amount || !idempotencykey) {
        return res.status(400).json({
            message: "toAccount, amount and idempotencykey are required"
        });
    }

    // 2. Fetch toUserAccount
    const toUserAccount = await accountModel.findOne({
        _id: toAccount,
    });

    if (!toUserAccount) {
        return res.status(400).json({
            message: "Invalid toAccount"
        });
    }

    // 3. Fetch fromUserAccount (system account)
    const fromUserAccount = await accountModel.findOne({
        user: req.user._id
    });

    if (!fromUserAccount) {
        return res.status(400).json({
            message: "System user account not found"
        });
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    const transaction = new transactionModel({
        fromAccount: fromUserAccount._id,
        toAccount,
        amount,
        idempotencykey,
        srtatus: "PENDING"
    });

    const debitLedgerEntry = await ledgerModel.create([{
        account: fromUserAccount._id,
        amount: amount,
        transaction: transaction._id,
        type: "DEBIT"
    }], { session });

    const creditLedgerEntry = await ledgerModel.create([{
        account: toAccount,
        amount: amount,
        transaction: transaction._id,
        type: "CREDIT"
    }], { session });

    transaction.status = "COMPLETED";

    await transaction.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
        message: "Transaction completed successfully",
        transaction: transaction
    });
}

module.exports = {
    createTransaction,
    createInitialFundsTransaction
}