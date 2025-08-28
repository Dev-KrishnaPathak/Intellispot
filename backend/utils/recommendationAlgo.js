const recommendationAlgo = {
  rank: (venues = []) => {
    return [...venues].sort((a, b) => {
      const scoreA = (a.rating || 0) - (a.travel?.etaMinutes || 0) * 0.01;
      const scoreB = (b.rating || 0) - (b.travel?.etaMinutes || 0) * 0.01;
      return scoreB - scoreA;
    });
  }
};

export default recommendationAlgo;
