import mongoose from "mongoose";

const feedbackSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  venue: {
    name: String,
    category: String,
    address: String,
  },
  liked: { type: Boolean, default: null },   
  rating: { type: Number, min: 1, max: 5 }, 
  comment: String,                           
  skipped: { type: Boolean, default: false }, 
  timestamp: { type: Date, default: Date.now }
});

export default mongoose.model("Feedback", feedbackSchema);
