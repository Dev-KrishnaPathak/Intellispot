import mongoose from 'mongoose';

const contextHistorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  context: { type: Object, required: true }
}, { timestamps: true });

export default mongoose.model('ContextHistory', contextHistorySchema);
