export async function adaptRecommendations(_req, res) {
  res.json({ adapted: true });
}

export async function recomputeLongTerm(_req, res) {
  res.json({ recomputed: true });
}
