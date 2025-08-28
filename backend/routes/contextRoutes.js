import express from 'express';
import { processContext, getContext } from '../controllers/contextController.js';
import { getRecommendations, getRecommendationsQuery } from '../controllers/recommendationController.js';

const router = express.Router();

router.post('/context', processContext);
router.get('/context', getContext);
router.post('/recommendations', getRecommendations);
router.get('/recommendations', getRecommendationsQuery);

export default router;
