const Invoice = require('../models/Invoice');

const getAllInvoices = async (userId) => {
  return await Invoice.find({ userId });
};

const createInvoice = async (invoiceData) => {
  const invoice = new Invoice(invoiceData);
  return await invoice.save();
};

const getInvoiceById = async (id, userId) => {
  const invoice = await Invoice.findOne({ _id: id, userId });
  if (!invoice) {
    throw new Error('Invoice not found');
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
    throw new Error('Invoice not found');
  }
  return invoice;
};

const deleteInvoice = async (id, userId) => {
  const invoice = await Invoice.findOneAndDelete({ _id: id, userId });
  if (!invoice) {
    throw new Error('Invoice not found');
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
