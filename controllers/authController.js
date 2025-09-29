const User = require('../models/User');
const bcrypt = require('bcryptjs');
const otpGenerator = require('otp-generator');
const sendEmail = require('../utils/email');

exports.register = async (req, reply) => {
  try {
    const { name, email, password, role } = req.body;

    let user = await User.findOne({ email });
    if (user) {
      return reply.code(400).send({ message: 'User already exists' });
    }

    user = new User({
      name,
      email,
      password,
      role
    });

    await user.save();

    reply.code(201).send({ message: 'User registered successfully' });
  } catch (err) {
    req.log.error(err);
    reply.code(500).send({ message: 'Server error' });
  }
};

exports.forgotPassword = async (req, reply) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
   
      return reply.code(200).send({ message: 'If a user with that email exists, a password reset OTP has been sent.' });
    }

    const otp = otpGenerator.generate(6, { 
      upperCaseAlphabets: false, 
      specialChars: false,
      lowerCaseAlphabets: false
    });

    user.passwordResetOTP = otp;

    user.passwordResetExpires = Date.now() + 10 * 60 * 1000; 
    await user.save({ validateBeforeSave: false });

   
    const message = `You are receiving this email because you (or someone else) have requested the reset of a password. Your OTP is: ${otp}\n\nIf you did not request this, please ignore this email.`;

    await sendEmail({
      email: user.email,
      subject: 'Your Password Reset OTP (valid for 10 min)',
      message
    });

    reply.code(200).send({ message: 'If a user with that email exists, a password reset OTP has been sent.' });

  } catch (err) {
    req.log.error(err);
  
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      user.passwordResetOTP = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });
    }
    reply.code(500).send({ message: 'Error sending email' });
  }
};

exports.resetPassword = async (req, reply) => {
  try {
    const { email, otp, password } = req.body;

    const user = await User.findOne({
      email,
      passwordResetOTP: otp,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return reply.code(400).send({ message: 'OTP is invalid or has expired' });
    }

    user.password = password;
    user.passwordResetOTP = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    reply.send({ message: 'Password has been reset successfully' });
  } catch (err) {
    req.log.error(err);
    reply.code(500).send({ message: 'Server error' });
  }
};

exports.login = async (req, reply) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return reply.code(400).send({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return reply.code(400).send({ message: 'Invalid credentials' });
    }

    user.loginHistory.push({ ipAddress: req.ip });
    await user.save();

    const token = await reply.jwtSign({
      id: user._id,
      name: user.name,
      role: user.role
    });

    reply.send({
      message: 'Logged in successfully',
      token,
      user:{
        name:user.name,
        role:user.role,
        email:user.email
      }
    });
  } catch (err) {
    req.log.error(err);
    reply.code(500).send({ message: 'Server error' });
  }
};