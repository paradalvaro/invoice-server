const Supplier = require("../models/Supplier");

const createSupplier = async (supplierData) => {
  // Get the last supplier number
  const lastSupplier = await Supplier.findOne().sort({ supplierNumber: -1 });
  const nextNumber =
    lastSupplier && lastSupplier.supplierNumber
      ? lastSupplier.supplierNumber + 1
      : 1;

  const supplier = new Supplier({
    ...supplierData,
    supplierNumber: nextNumber,
  });
  return await supplier.save();
};

const getSuppliers = async (
  page = 1,
  limit = 10,
  search = "",
  sortBy = "name",
  order = "asc",
) => {
  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: "i" } },
      { nif: { $regex: search, $options: "i" } },
    ];
  }

  const sort = {};
  sort[sortBy] = order === "asc" ? 1 : -1;

  const suppliers = await Supplier.find(query)
    .sort(sort)
    .skip((page - 1) * limit)
    .limit(limit);

  const total = await Supplier.countDocuments(query);

  return {
    suppliers,
    totalPages: Math.ceil(total / limit),
    currentPage: page,
    totalItems: total,
  };
};

const getSupplierById = async (id) => {
  const supplier = await Supplier.findById(id);
  if (!supplier) {
    throw new Error("Supplier not found");
  }
  return supplier;
};

const updateSupplier = async (id, updateData) => {
  const supplier = await Supplier.findByIdAndUpdate(id, updateData, {
    new: true,
  });
  if (!supplier) {
    throw new Error("Supplier not found");
  }
  return supplier;
};

const deleteSupplier = async (id) => {
  const supplier = await Supplier.findByIdAndDelete(id);
  if (!supplier) {
    throw new Error("Supplier not found");
  }
  return supplier;
};

const getNextSupplierNumber = async () => {
  const lastSupplier = await Supplier.findOne().sort({ supplierNumber: -1 });
  return lastSupplier && lastSupplier.supplierNumber
    ? lastSupplier.supplierNumber + 1
    : 1;
};

module.exports = {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
  deleteSupplier,
  getNextSupplierNumber,
};
