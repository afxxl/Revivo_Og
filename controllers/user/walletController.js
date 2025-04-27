const User = require("../../models/userSchema");
const Wallet = require("../../models/walletSchema");
const Order = require("../../models/orderSchema");

const getWalletPage = async (req, res) => {
  try {
    const userId = req.session.user;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).render("page-404", {
        message: "User not found",
      });
    }

    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        transactions: [],
      });
    }

    res.render("wallet", {
      wallet,
      user,
    });
  } catch (error) {
    console.error("Error fetching wallet:", error);
    res.status(500).render("error", {
      message: "Could not load wallet information",
      error,
    });
  }
};

const processWalletRefund = async (userId, amount, description) => {
  try {
    if (!userId) {
      return { success: false, error: "No userId provided" };
    }

    if (!amount || amount <= 0) {
      return { success: false, error: "Invalid refund amount" };
    }

    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        transactions: [],
      });
    }

    const oldBalance = wallet.balance;

    wallet.transactions.push({
      transactionType: "credit",
      transactionAmount: amount,
      description: description || "Refund",
      createdAt: new Date(),
    });

    wallet.balance += amount;

    await wallet.save();

    return { success: true, wallet };
  } catch (error) {
    console.error("Error processing wallet refund:", error);
    return { success: false, error: error.message };
  }
};

const deductFromWallet = async (userId, amount, description) => {
  try {
    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return { success: false, error: "Wallet not found" };
    }

    if (wallet.balance < amount) {
      return { success: false, error: "Insufficient wallet balance" };
    }

    wallet.transactions.push({
      transactionType: "debit",
      transactionAmount: amount,
      description: description || "Purchase",
    });

    wallet.balance -= amount;

    await wallet.save();
    return { success: true, wallet };
  } catch (error) {
    console.error("Error deducting from wallet:", error);
    return { success: false, error };
  }
};

const checkWalletBalance = async (userId) => {
  try {
    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return { success: true, balance: 0 };
    }

    return { success: true, balance: wallet.balance };
  } catch (error) {
    console.error("Error checking wallet balance:", error);
    return { success: false, error };
  }
};

module.exports = {
  getWalletPage,
  processWalletRefund,
  deductFromWallet,
  checkWalletBalance,
};
