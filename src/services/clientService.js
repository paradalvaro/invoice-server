const Client = require("../models/Client");

const createClient = async (clientData) => {
  // Get the last client number
  const lastClient = await Client.findOne().sort({ clientNumber: -1 });
  const nextNumber =
    lastClient && lastClient.clientNumber ? lastClient.clientNumber + 1 : 1;

  const client = new Client({
    ...clientData,
    clientNumber: nextNumber,
  });
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

const getNextClientNumber = async () => {
  const lastClient = await Client.findOne().sort({ clientNumber: -1 });
  return lastClient && lastClient.clientNumber
    ? lastClient.clientNumber + 1
    : 1;
};

module.exports = {
  createClient,
  getClients,
  getClientById,
  updateClient,
  deleteClient,
  getNextClientNumber,
};
