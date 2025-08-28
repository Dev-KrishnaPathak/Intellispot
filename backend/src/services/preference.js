import User from "../models/User.js";

export async function getUserPreferences(userId) {
  const user = await User.findById(userId).lean();
  return user.preferences || {};
}
