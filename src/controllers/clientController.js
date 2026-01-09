const clientService = require("../services/clientService");

const createClient = async (req, res) => {
  try {
    const clientData = { ...req.body, userId: req.user.id };
    const client = await clientService.createClient(clientData);
    res.status(201).json(client);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getClients = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const result = await clientService.getClients(
      parseInt(page),
      parseInt(limit),
      search
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getClient = async (req, res) => {
  try {
    const client = await clientService.getClientById(req.params.id);
    res.json(client);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const updateClient = async (req, res) => {
  try {
    const client = await clientService.updateClient(req.params.id, req.body);
    res.json(client);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const deleteClient = async (req, res) => {
  try {
    await clientService.deleteClient(req.params.id);
    res.json({ message: "Client removed" });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

module.exports = {
  createClient,
  getClients,
  getClient,
  updateClient,
  deleteClient,
};
