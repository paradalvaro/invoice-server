const Invoice = require("../models/Invoice");

const getAllInvoices = async (
  userId,
  userType,
  page = 1,
  limit = 10,
  sortBy = "date",
  order = "desc",
  search = "",
  searchField = "clientName",
  status = "",
  dueDateRange = ""
) => {
  const skip = (page - 1) * limit;

  const filter =
    userType === "Admin" || userType === "SuperAdmin" ? {} : { userId };

  // Status Filter
  if (status) {
    filter.status = status;
  }

  // Due Date Range Filter
  if (dueDateRange) {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate()
    );

    if (dueDateRange === "thisMonth") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59
      );
      filter.dueDate = { $gte: startOfMonth, $lte: endOfMonth };
    } else if (dueDateRange === "nextMonth") {
      const startOfNextMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1
      );
      const endOfNextMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 2,
        0,
        23,
        59,
        59
      );
      filter.dueDate = { $gte: startOfNextMonth, $lte: endOfNextMonth };
    } else if (dueDateRange === "moreThanTwoMonths") {
      const endOfNextMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 2,
        0,
        23,
        59,
        59
      );
      filter.dueDate = { $gt: endOfNextMonth };
    } else if (dueDateRange === "next30Days") {
      const date30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      filter.dueDate = { $gte: startOfToday, $lte: date30 };
    } else if (dueDateRange === "next60Days") {
      const date60 = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
      filter.dueDate = { $gte: startOfToday, $lte: date60 };
    } else if (dueDateRange === "next90Days") {
      const date90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      filter.dueDate = { $gte: startOfToday, $lte: date90 };
    } else if (dueDateRange === "moreThan90Days") {
      const date90 = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
      filter.dueDate = { $gt: date90 };
    }
  }

  // General Search Filter
  if (search) {
    // Validate allowed fields for security
    const allowedFields = [
      "clientName",
      "clientNIF",
      "invoiceNumber",
      "status",
      "date",
      "dueDate",
      "serie",
      "type",
    ];
    const field = allowedFields.includes(searchField)
      ? searchField
      : "clientName";

    if (field === "date" || field === "dueDate") {
      const startDate = new Date(search);
      const endDate = new Date(search);
      endDate.setDate(endDate.getDate() + 1);

      if (!isNaN(startDate.getTime())) {
        // Only override if not already set by dueDateRange
        if (!filter[field]) {
          filter[field] = {
            $gte: startDate,
            $lt: endDate,
          };
        }
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
  if (updateData.services && Array.isArray(updateData.services)) {
    updateData.totalAmount = updateData.services.reduce(
      (acc, service) => acc + (service.taxBase + service.iva),
      0
    );
  }
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

const getNextInvoiceNumber = async (serie) => {
  const lastInvoice = await Invoice.findOne({ serie })
    .sort({ invoiceNumber: -1 })
    .collation({ locale: "en_US", numericOrdering: true }); // Ensure numeric sort

  if (lastInvoice && lastInvoice.invoiceNumber) {
    return lastInvoice.invoiceNumber + 1;
  }
  return 1;
};

const getInvoiceBySerieAndNumber = async (serie, invoiceNumber) => {
  const invoice = await Invoice.findOne({
    serie: serie,
    invoiceNumber: invoiceNumber,
  });
  if (!invoice) {
    //throw new Error("Invoice not found");
    return "";
  }
  return invoice;
};

const getInvoicePreviousHash = async (serie, invoiceNumber) => {
  let previousHash = "";
  try {
    previousHash = await getInvoiceBySerieAndNumber(serie, invoiceNumber - 1);
  } catch (error) {
    console.log(error);
  }
  return previousHash.hash || "";
};

module.exports = {
  getAllInvoices,
  createInvoice,
  getInvoiceById,
  updateInvoice,
  deleteInvoice,
  getNextInvoiceNumber,
  getInvoiceBySerieAndNumber,
  getInvoicePreviousHash,
};
