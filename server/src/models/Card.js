import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    text: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const labelSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    color: { type: String, required: true }
  },
  { _id: true }
);

const cardSchema = new mongoose.Schema(
  {
    board: { type: mongoose.Schema.Types.ObjectId, ref: 'Board', required: true, index: true },
    list: { type: mongoose.Schema.Types.ObjectId, ref: 'List', required: true, index: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    position: { type: Number, required: true, default: 1000 },
    labels: [labelSchema],
    assignees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    dueDate: { type: Date, default: null },
    comments: [commentSchema]
  },
  { timestamps: true }
);

cardSchema.index({ board: 1, list: 1, position: 1 });

export default mongoose.model('Card', cardSchema);
