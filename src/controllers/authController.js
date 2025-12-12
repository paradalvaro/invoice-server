const authService = require("../services/authService");

const register = async (req, res) => {
  const { username, password, name, lastName, type } = req.body;
  const photoUrl = req.file ? `/uploads/${req.file.filename}` : null;

  try {
    const data = await authService.registerUser(
      username,
      password,
      name,
      lastName,
      type,
      photoUrl
    );
    res.status(201).json(data);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const login = async (req, res) => {
  const { username, password } = req.body;

  try {
    const data = await authService.loginUser(username, password);
    res.json(data);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await authService.getAllUsers();
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const userData = { ...req.body };
    if (req.file) {
      userData.photoUrl = `/uploads/${req.file.filename}`;
    }
    const user = await authService.updateUser(req.params.id, userData);
    res.json(user);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    await authService.deleteUser(req.params.id);
    res.json({ message: "User removed" });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

module.exports = {
  register,
  login,
  getUsers,
  updateUser,
  deleteUser,
};
