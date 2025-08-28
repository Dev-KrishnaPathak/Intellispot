import Feedback from "../models/Feedback.js";
import User from "../models/User.js";


export async function saveFeedback(userId, venue, options) {
  const { liked, rating, comment, skipped } = options;

  const feedback = new Feedback({
    user: userId,
    venue,
    liked: liked || null,
    rating: rating || null,
    comment: comment || null,
    skipped: skipped || false,
  });

  await feedback.save();

  if (liked !== undefined && !skipped) {
    const user = await User.findById(userId);
    if (!user.preferences) user.preferences = { scores: {} };
    if (!user.preferences.scores[venue.category]) user.preferences.scores[venue.category] = 0;
    user.preferences.scores[venue.category] += liked ? 5 : -3;
    await user.save();
  }

  return feedback;
}
