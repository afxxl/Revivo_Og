const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    status: String,
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    method: {
        type: String,
        enum: ['COD', 'ONLINE', 'WALLET']
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    amount: Number,
    transactionId: String,
    paymentGateway: String
}, { timestamps: true });

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
