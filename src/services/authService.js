const User = require("../models/User");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const registerUser = async (
  username,
  password,
  name,
  lastName,
  type,
  photoUrl
) => {
  const existingUser = await User.findOne({ username });
  if (existingUser) {
    throw new Error("User already exists");
  }
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = new User({
    username,
    password: hashedPassword,
    name,
    lastName,
    type,
    photoUrl,
  });

  await user.save();

  const token = jwt.sign(
    { id: user._id, type: user.type },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );

  return {
    token,
    user: {
      id: user._id,
      username: user.username,
      name: user.name,
      lastName: user.lastName,
      type: user.type,
      photoUrl: user.photoUrl,
    },
  };
};

const loginUser = async (username, password) => {
  const user = await User.findOne({ username });
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    throw new Error("Invalid credentials");
  }

  const token = jwt.sign(
    { id: user._id, type: user.type },
    process.env.JWT_SECRET,
    {
      expiresIn: "1h",
    }
  );

  return {
    token,
    user: {
      id: user._id,
      username: user.username,
      name: user.name,
      lastName: user.lastName,
      type: user.type,
      photoUrl: user.photoUrl,
    },
  };
};

const getAllUsers = async () => {
  return await User.find({}).select("-password");
};

const updateUser = async (id, userData) => {
  const user = await User.findByIdAndUpdate(id, userData, { new: true }).select(
    "-password"
  );
  if (!user) {
    throw new Error("User not found");
  }
  return user;
};

const deleteUser = async (id) => {
  const user = await User.findByIdAndDelete(id);
  if (!user) {
    throw new Error("User not found");
  }
  return user;
};

module.exports = {
  registerUser,
  loginUser,
  getAllUsers,
  updateUser,
  deleteUser,
};
