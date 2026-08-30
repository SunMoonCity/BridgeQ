

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');
const validator = require('validator');

const StudentSchema = new mongoose.Schema(
  {
    /* ── Core auth fields ─────────────────────────────── */
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (v) => validator.isEmail(v),
        message: 'Invalid email address'
      }
    },
    rollNo: {
      type: String,
      required: [true, 'Roll number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false   // never returned by default in queries
    },
    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student'
    },

    /* ── Extensible profile fields ────────────────────── */
    name:       { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    year:       { type: Number, min: 1, max: 5 }
  },
  {
    timestamps: true   // adds createdAt + updatedAt automatically
  }
);

/* ── Indexes ─────────────────────────────────────────────
   NOTE: unique:true already creates the index on email and rollNo.
   No need to call StudentSchema.index() again. */
/* ── Pre-save hook: hash password whenever it changes ── */
StudentSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

/* ── Instance method: compare plain password with hash ─ */
StudentSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

/* ── Never expose the password hash in JSON output ───── */
StudentSchema.set('toJSON', {
  transform (doc, ret) {
    delete ret.password;
    return ret;
  }
});

module.exports = mongoose.model('Student', StudentSchema);
