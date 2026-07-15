import mongoose from 'mongoose'

const counterSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true },
    value: { type: Number, required: true, default: 0 },
  },
  { timestamps: true, versionKey: false }
)

export default mongoose.model('Counter', counterSchema)
