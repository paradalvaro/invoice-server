const authService = require('../services/authService');

const register = async (req, res) => {
  const { username, password } = req.body;

  try {
    const data = await authService.registerUser(username, password);
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

module.exports = {
  register,
  login,
};
