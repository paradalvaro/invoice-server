const Client = require("../models/Client");

const createClient = async (clientData) => {
  const client = new Client(clientData);
  return await client.save();
};

const getClients = async (page = 1, limit = 10, search = "") => {
  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { nif: { $regex: search, $options: "i" } },
    ];
  }

  const clients = await Client.find(query)
    .sort({ name: 1 })
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await Client.countDocuments(query);

  return {
    clients,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    totalClients: total,
  };
};

const getClientById = async (id) => {
  const client = await Client.findById(id);
  if (!client) {
    throw new Error("Client not found");
  }
  return client;
};

const updateClient = async (id, updateData) => {
  const client = await Client.findByIdAndUpdate(id, updateData, { new: true });
  if (!client) {
    throw new Error("Client not found");
  }
  return client;
};

const deleteClient = async (id) => {
  const client = await Client.findByIdAndDelete(id);
  if (!client) {
    throw new Error("Client not found");
  }
  return client;
};

module.exports = {
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient,
};
