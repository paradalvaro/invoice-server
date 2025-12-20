const Invoice = require("../models/Invoice");

const getAllInvoices = async (
  userId,
  userType,
  page = 1,
  limit = 10,
  sortBy = "date",
  order = "desc",
  search = "",
  searchField = "clientName"
) => {
  const skip = (page - 1) * limit;

  const filter =
    userType === "Admin" || userType === "SuperAdmin" ? {} : { userId };

  if (search) {
    // Validate allowed fields for security
    const allowedFields = [
      "clientName",
      "invoiceNumber",
      "status",
      "date",
      "dueDate",
      "serie",
    ];
    const field = allowedFields.includes(searchField)
      ? searchField
      : "clientName";

    if (field === "date" || field === "dueDate") {
      const startDate = new Date(search);
      const endDate = new Date(search);
      endDate.setDate(endDate.getDate() + 1);

      if (!isNaN(startDate.getTime())) {
        filter[field] = {
          $gte: startDate,
          $lt: endDate,
        };
      }
    } else if (field === "invoiceNumber") {
      const numSearch = Number(search);
      if (!isNaN(numSearch)) {
        filter[field] = numSearch;
      }
    } else {
      const searchRegex = new RegExp(search, "i");
      filter[field] = searchRegex;
    }
  }

  const sortOptions = {};
  sortOptions[sortBy] = order === "asc" ? 1 : -1;

  const invoices = await Invoice.find(filter)
    .skip(skip)
    .limit(limit)
    .sort(sortOptions)
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
  console.log(invoice);
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
  console.log(invoice);
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

const getNextInvoiceNumber = async (serie) => {
  const lastInvoice = await Invoice.findOne({ serie })
    .sort({ invoiceNumber: -1 })
    .collation({ locale: "en_US", numericOrdering: true }); // Ensure numeric sort

  if (lastInvoice && lastInvoice.invoiceNumber) {
    return lastInvoice.invoiceNumber + 1;
  }
  return 1;
};

module.exports = {
  getAllInvoices,
  createInvoice,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  getNextInvoiceNumber,
};
