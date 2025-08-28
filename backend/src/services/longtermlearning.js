import Feedback from "../models/Feedback.js";
import User from "../models/User.js";

/**
 * @param {string} userId
 */
export async function computeLongTermPreferences(userId) {
  const user = await User.findById(userId);
  if (!user) return null;

  const feedbacks = await Feedback.find({ user: userId }).sort({ timestamp: 1 });

  const categoryStats = {};

  feedbacks.forEach(fb => {
    const catRaw = fb?.venue?.category || 'uncategorized';
    const cat = catRaw.toLowerCase();
    if (!categoryStats[cat]) categoryStats[cat] = { likes: 0, dislikes: 0, ratings: [], skips: 0 };

    if (fb.liked !== undefined && fb.liked !== null) {
      fb.liked ? categoryStats[cat].likes++ : categoryStats[cat].dislikes++;
    }
    if (typeof fb.rating === 'number') categoryStats[cat].ratings.push(fb.rating);
    if (fb.skipped) categoryStats[cat].skips++;
  });

  const longTermPreferences = {};
  Object.keys(categoryStats).forEach(cat => {
    const stats = categoryStats[cat];
    const avgRating = stats.ratings.length ? stats.ratings.reduce((a, b) => a + b, 0) / stats.ratings.length : 0;
    longTermPreferences[cat] =
      stats.likes * 5 + avgRating * 2 - stats.dislikes * 3 - stats.skips * 2; // Example weighting
  });

  if (!user.preferences) user.preferences = {};
  user.preferences.longTermScores = longTermPreferences;
  await user.save();

  return longTermPreferences;
}

/**
 * @param {Array} venues
 * @param {Object} context
 * @param {Object} userPreferences 
 */
export function longTermRankVenues(venues, context, userPreferences = {}) {
  return (venues || [])
    .map(venue => {
      let score = 0;

      if (typeof venue.distance === 'number') score += Math.max(0, 50 - venue.distance / 10);
      if (typeof venue.rating === 'number') score += venue.rating * 10;

      const cat = (venue.category || 'uncategorized').toLowerCase();

      if (userPreferences.scores && userPreferences.scores[cat]) score += userPreferences.scores[cat];

      if (userPreferences.longTermScores && userPreferences.longTermScores[cat]) {
        score += userPreferences.longTermScores[cat] * 0.5; // weight long-term less than short-term
      }

      if (context?.suggestQuiet && cat.includes("cafe")) score += 10;
      if (context?.suggestOutdoor && cat.includes("park")) score += 10;

      return { ...venue, score };
    })
    .sort((a, b) => b.score - a.score);
}

export default { computeLongTermPreferences, longTermRankVenues };

