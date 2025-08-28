import { Router } from 'express';
const router = Router();

router.post('/', (req, res) => {
  res.status(201).json({ received: true, payload: req.body });
});

export default router;
