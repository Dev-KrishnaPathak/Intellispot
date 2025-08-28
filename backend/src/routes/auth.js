import { Router } from 'express';
const router = Router();

router.post('/login', (req, res) => {
  return res.json({ token: 'fake-jwt', user: { id: '123', email: req.body.email } });
});

export default router;
