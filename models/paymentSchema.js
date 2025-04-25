const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    status: {
        type: String,
        enum: ['Pending', 'Completed', 'Failed', 'Refunded'],
        default: 'Pending'
    },
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
        enum: ['COD', 'ONLINE', 'WALLET', 'RAZORPAY']
    },
    orderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Order'
    },
    amount: Number,
    transactionId: String,
    paymentGateway: String,
    // Razorpay specific fields
    razorpay: {
        orderId: String,
        paymentId: String,
        signature: String
    },
    // Refund information
    refund: {
        refundId: String,
        amount: Number,
        createdAt: Date,
        status: {
            type: String,
            enum: ['pending', 'processed', 'failed'],
            default: 'processed'
        },
        reason: String
    }
}, { timestamps: true });

const Payment = mongoose.model('Payment', paymentSchema);
module.exports = Payment;
