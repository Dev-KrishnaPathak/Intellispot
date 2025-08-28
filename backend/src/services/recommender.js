/**
 * @param {Array} venues
 * @param {Object} context 
 */
export function rankVenues(venues, context) {
  return venues
    .map(venue => {
      let score = 0;

      if (venue.distance) score += Math.max(0, 50 - venue.distance / 10);

      if (venue.rating) score += venue.rating * 10;

      const pref = context.preferences;
      if (pref.coffee && venue.category.toLowerCase().includes("coffee")) score += 20;
      if (pref.quietPlaces && venue.category.toLowerCase().includes("library")) score += 20;
      if (pref.outdoor && venue.category.toLowerCase().includes("park")) score += 15;

      if (context.suggestQuiet && venue.category.toLowerCase().includes("cafe")) score += 10;
      if (context.suggestOutdoor && venue.category.toLowerCase().includes("park")) score += 10;

      return { ...venue, score };
    })
    .sort((a, b) => b.score - a.score); 
}
