import { Router } from 'express';
import { getSmartRecommendations } from '../controllers/intelliSpotController.js';

const router = Router();

router.get('/recommendations', getSmartRecommendations);

export default router;
