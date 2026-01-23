const supplierService = require("../services/supplierService");

const createSupplier = async (req, res) => {
  try {
    const supplierData = { ...req.body, userId: req.user.id };
    const supplier = await supplierService.createSupplier(supplierData);
    res.status(201).json(supplier);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getSuppliers = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      sortBy = "name",
      order = "asc",
    } = req.query;
    const result = await supplierService.getSuppliers(
      parseInt(page),
      parseInt(limit),
      search,
      sortBy,
      order,
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const getSupplier = async (req, res) => {
  try {
    const supplier = await supplierService.getSupplierById(req.params.id);
    res.json(supplier);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const supplier = await supplierService.updateSupplier(
      req.params.id,
      req.body,
    );
    res.json(supplier);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const deleteSupplier = async (req, res) => {
  try {
    await supplierService.deleteSupplier(req.params.id);
    res.json({ message: "Supplier removed" });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const getNextSupplierNumber = async (req, res) => {
  try {
    const nextNumber = await supplierService.getNextSupplierNumber();
    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  createSupplier,
  getSuppliers,
  getSupplier,
  updateSupplier,
  deleteSupplier,
  getNextSupplierNumber,
};
