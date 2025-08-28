import Feedback from "../models/Feedback.js";
import User from "../models/User.js";

/**
 
 * @param {string} userId
 */
export async function adaptRecommendations(userId) {
  const user = await User.findById(userId);
  if (!user) return;

  user.preferences = user.preferences || { scores: {} };

  const feedbacks = await Feedback.find({ user: userId }).sort({ timestamp: -1 }).limit(100);

  const categoryScores = {};
  feedbacks.forEach(fb => {
    const cat = fb.venue.category.toLowerCase();
    if (!categoryScores[cat]) categoryScores[cat] = 0;

    if (fb.liked !== undefined) categoryScores[cat] += fb.liked ? 5 : -3;
    if (fb.rating) categoryScores[cat] += fb.rating;
    if (fb.skipped) categoryScores[cat] -= 2;
  });

  Object.keys(categoryScores).forEach(cat => {
    user.preferences.scores[cat] = categoryScores[cat];
  });

  await user.save();

  return user.preferences.scores;
}

export function adaptiveRankVenues(venues, context, userPreferences) {
  return venues
    .map(venue => {
      let score = 0;

      if (venue.distance) score += Math.max(0, 50 - venue.distance / 10);
      if (venue.rating) score += venue.rating * 10;

      const cat = venue.category.toLowerCase();
      if (userPreferences.scores[cat]) score += userPreferences.scores[cat];

      if (context.suggestQuiet && venue.category.toLowerCase().includes("cafe")) score += 10;
      if (context.suggestOutdoor && venue.category.toLowerCase().includes("park")) score += 10;

      return { ...venue, score };
    })
    .sort((a, b) => b.score - a.score); 
}
