const Invoice = require("../models/Invoice");

const getAllInvoices = async (userId, userType, page = 1, limit = 10) => {
  const skip = (page - 1) * limit;

  const filter =
    userType === "Admin" || userType === "SuperAdmin" ? {} : { userId };

  const invoices = await Invoice.find(filter)
    .skip(skip)
    .limit(limit)
    .sort({ date: -1 })
    .populate("userId", "username name lastName"); // Populate user details

  const totalItems = await Invoice.countDocuments(filter);
  const totalPages = Math.ceil(totalItems / limit);

  return {
    data: invoices,
    currentPage: Number(page),
    totalPages,
    totalItems,
  };
};

const createInvoice = async (invoiceData) => {
  const invoice = new Invoice(invoiceData);
  return await invoice.save();
};

const getInvoiceById = async (id, userId) => {
  const invoice = await Invoice.findOne({ _id: id, userId });
  if (!invoice) {
    throw new Error("Invoice not found");
  }
  return invoice;
};

const updateInvoice = async (id, userId, updateData) => {
  const invoice = await Invoice.findOneAndUpdate(
    { _id: id, userId },
    updateData,
    { new: true }
  );
  if (!invoice) {
    throw new Error("Invoice not found");
  }
  return invoice;
};

const deleteInvoice = async (id, userId) => {
  const invoice = await Invoice.findOneAndDelete({ _id: id, userId });
  if (!invoice) {
    throw new Error("Invoice not found");
  }
  return invoice;
};

module.exports = {
  getAllInvoices,
  createInvoice,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
};
