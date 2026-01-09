const mongoose = require("mongoose");
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

  // Explicitly cast userId to ObjectId for aggregation if it's in the filter
  if (filter.userId && typeof filter.userId === "string") {
    filter.userId = new mongoose.Types.ObjectId(filter.userId);
  } else if (
    filter.userId &&
    filter.userId instanceof mongoose.Types.ObjectId === false
  ) {
    // If it's already an object but not an ObjectId (e.g. from a previous check),
    // we ensure it's the right type for the aggregation $match stage if necessary.
    // In this service, it coming from req.user.id is usually a string.
    filter.userId = new mongoose.Types.ObjectId(filter.userId);
  }

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

  // Calculate totals for Balance Bar
  const now = new Date();
  const totalsAggregation = await Invoice.aggregate([
    { $match: filter },
    {
      $group: {
        _id: null,
        paid: {
          $sum: {
            $cond: [{ $eq: ["$status", "Paid"] }, "$totalAmount", 0],
          },
        },
        pending: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "Pending"] },
                  { $gte: ["$dueDate", now] },
                ],
              },
              "$totalAmount",
              0,
            ],
          },
        },
        expired: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ["$status", "Pending"] },
                  { $lt: ["$dueDate", now] },
                ],
              },
              "$totalAmount",
              0,
            ],
          },
        },
      },
    },
  ]);

  const totals =
    totalsAggregation.length > 0
      ? totalsAggregation[0]
      : { paid: 0, pending: 0, expired: 0 };
  delete totals._id;

  return {
    data: invoices,
    currentPage: Number(page),
    totalPages,
    totalItems,
    totals,
  };
};

const createInvoice = async (invoiceData) => {
  const invoice = new Invoice(invoiceData);
  return await invoice.save();
};

const getInvoiceById = async (id, userId, userType) => {
  const filter =
    userType === "Admin" || userType === "SuperAdmin"
      ? { _id: id }
      : { _id: id, userId };
  const invoice = await Invoice.findOne(filter).populate("client");
  if (!invoice) {
    throw new Error("Invoice not found");
  }
  return invoice;
};

const updateInvoice = async (id, userId, userType, updateData) => {
  if (updateData.services && Array.isArray(updateData.services)) {
    updateData.totalAmount = updateData.services.reduce(
      (acc, service) => acc + (service.taxBase + (service.iva || 0)),
      0
    );
  }

  // Update balanceDue if totalAmount changes and not paid
  if (updateData.status === "Paid") {
    updateData.balanceDue = 0;
  } else if (updateData.totalAmount !== undefined) {
    updateData.balanceDue = updateData.totalAmount;
  }

  const filter =
    userType === "Admin" || userType === "SuperAdmin"
      ? { _id: id }
      : { _id: id, userId };

  const invoice = await Invoice.findOneAndUpdate(filter, updateData, {
    new: true,
  });
  if (!invoice) {
    throw new Error("Invoice not found");
  }
  return invoice;
};

const deleteInvoice = async (id, userId, userType) => {
  const filter =
    userType === "Admin" || userType === "SuperAdmin"
      ? { _id: id }
      : { _id: id, userId };
  const invoice = await Invoice.findOneAndDelete(filter);
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
  markAsPaid,
  getModelo347Data,
};

async function markAsPaid(id, userId, userType) {
  const filter =
    userType === "Admin" || userType === "SuperAdmin"
      ? { _id: id }
      : { _id: id, userId };
  const invoice = await Invoice.findOneAndUpdate(
    filter,
    { status: "Paid", balanceDue: 0 },
    { new: true }
  );
  if (!invoice) {
    throw new Error("Invoice not found");
  }
  return invoice;
}

async function getModelo347Data(year, userType) {
  const startOfYear = new Date(year, 0, 1);
  const endOfYear = new Date(year, 11, 31, 23, 59, 59);

  const matchStage = {
    date: { $gte: startOfYear, $lte: endOfYear },
    status: { $ne: "Draft" },
    type: { $ne: "F2" },
    client: { $exists: true, $ne: null },
  };

  const aggregation = await Invoice.aggregate([
    { $match: matchStage },
    {
      $project: {
        client: 1,
        totalAmount: 1,
        date: 1,
        quarter: {
          $ceil: { $divide: [{ $month: "$date" }, 3] },
        },
      },
    },
    {
      $group: {
        _id: "$client",
        totalAmount: { $sum: "$totalAmount" },
        q1: {
          $sum: {
            $cond: [{ $eq: ["$quarter", 1] }, "$totalAmount", 0],
          },
        },
        q2: {
          $sum: {
            $cond: [{ $eq: ["$quarter", 2] }, "$totalAmount", 0],
          },
        },
        q3: {
          $sum: {
            $cond: [{ $eq: ["$quarter", 3] }, "$totalAmount", 0],
          },
        },
        q4: {
          $sum: {
            $cond: [{ $eq: ["$quarter", 4] }, "$totalAmount", 0],
          },
        },
      },
    },
    {
      $match: {
        totalAmount: { $gt: 3005.06 },
      },
    },
    {
      $lookup: {
        from: "clients",
        localField: "_id",
        foreignField: "_id",
        as: "clientDetails",
      },
    },
    {
      $unwind: "$clientDetails",
    },
    {
      $project: {
        _id: 1,
        totalAmount: 1,
        q1: 1,
        q2: 1,
        q3: 1,
        q4: 1,
        clientName: "$clientDetails.name",
        clientNIF: "$clientDetails.nif",
        clientAddress: "$clientDetails.address",
        clientCity: "$clientDetails.city",
        clientProvince: "$clientDetails.province",
        clientPostalCode: "$clientDetails.postalCode",
      },
    },
  ]);

  return aggregation;
}
