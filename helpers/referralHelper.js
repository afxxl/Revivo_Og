const crypto = require("crypto");
const User = require("../models/userSchema");
const Wallet = require("../models/walletSchema");

const REFERRER_REWARD = 100;
const REFEREE_REWARD = 50;

const generateReferralCode = async () => {
  let isUnique = false;
  let referralCode;

  while (!isUnique) {
    referralCode = crypto.randomBytes(4).toString("hex").toUpperCase();

    const existingUser = await User.findOne({ referralCode });
    if (!existingUser) {
      isUnique = true;
    }
  }

  return referralCode;
};

const addReferralReward = async (userId, amount, description) => {
  try {
    let wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      wallet = new Wallet({
        userId,
        balance: 0,
        transactions: [],
      });
    }

    wallet.transactions.push({
      transactionType: "credit",
      transactionAmount: amount,
      description,
    });

    wallet.balance += amount;

    await wallet.save();

    return { success: true };
  } catch (error) {
    console.error("Error adding referral reward:", error);
    return { success: false, error };
  }
};

const processReferralReward = async (newUser, referralCode) => {
  try {
    if (!referralCode) return;

    const referrer = await User.findOne({ referralCode });

    if (!referrer) return;

    newUser.referredBy = referrer._id;
    await newUser.save();

    await addReferralReward(
      referrer._id,
      REFERRER_REWARD,
      `Referral bonus for inviting ${newUser.name}`,
    );

    await addReferralReward(
      newUser._id,
      REFEREE_REWARD,
      `Welcome bonus for joining with a referral`,
    );

    return { success: true };
  } catch (error) {
    console.error("Error processing referral reward:", error);
    return { success: false, error };
  }
};

module.exports = {
  generateReferralCode,
  processReferralReward,
  REFERRER_REWARD,
  REFEREE_REWARD,
};
