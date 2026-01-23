const mongoose = require("mongoose");
const Bill = require("../models/Bill");

const getAllBills = async (
  userId,
  userType,
  page = 1,
  limit = 10,
  sortBy = "date",
  order = "desc",
  search = "",
  searchField = "supplierName",
  status = "",
  dueDateRange = "",
) => {
  const skip = (page - 1) * limit;

  const filter =
    userType === "Admin" || userType === "SuperAdmin" ? {} : { userId };

  if (filter.userId && typeof filter.userId === "string") {
    filter.userId = new mongoose.Types.ObjectId(filter.userId);
  }

  if (status) {
    filter.status = status;
  }

  if (dueDateRange) {
    const now = new Date();
    const startOfToday = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );

    if (dueDateRange === "thisMonth") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0,
        23,
        59,
        59,
      );
      filter.dueDate = { $gte: startOfMonth, $lte: endOfMonth };
    } else if (dueDateRange === "nextMonth") {
      const startOfNextMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        1,
      );
      const endOfNextMonth = new Date(
        now.getFullYear(),
        now.getMonth() + 2,
        0,
        23,
        59,
        59,
      );
      filter.dueDate = { $gte: startOfNextMonth, $lte: endOfNextMonth };
    } else if (dueDateRange === "next30Days") {
      const date30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      filter.dueDate = { $gte: startOfToday, $lte: date30 };
    }
  }

  if (search) {
    const allowedFields = [
      "supplierName",
      "supplierNIF",
      "billNumber",
      "status",
      "date",
      "dueDate",
      "serie",
    ];
    const field = allowedFields.includes(searchField)
      ? searchField
      : "supplierName";

    if (field === "date" || field === "dueDate") {
      const startDate = new Date(search);
      const endDate = new Date(search);
      endDate.setDate(endDate.getDate() + 1);

      if (!isNaN(startDate.getTime())) {
        if (!filter[field]) {
          filter[field] = {
            $gte: startDate,
            $lt: endDate,
          };
        }
      }
    } else if (field === "billNumber") {
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

  const bills = await Bill.find(filter)
    .skip(skip)
    .limit(limit)
    .sort(sortOptions)
    .populate("userId", "username name lastName")
    .populate("supplier", "email");

  const totalItems = await Bill.countDocuments(filter);
  const totalPages = Math.ceil(totalItems / limit);

  return {
    data: bills,
    currentPage: Number(page),
    totalPages,
    totalItems,
  };
};

const createBill = async (billData) => {
  const bill = new Bill(billData);
  return await bill.save();
};

const getBillById = async (id, userId, userType) => {
  const filter =
    userType === "Admin" || userType === "SuperAdmin"
      ? { _id: id }
      : { _id: id, userId };
  const bill = await Bill.findOne(filter).populate("supplier");
  if (!bill) {
    throw new Error("Bill not found");
  }
  return bill;
};

const updateBill = async (id, userId, userType, updateData) => {
  const forbiddenFields = ["_id", "__v", "userId", "createdAt", "updatedAt"];
  forbiddenFields.forEach((field) => delete updateData[field]);

  if (updateData.services && Array.isArray(updateData.services)) {
    updateData.totalAmount = updateData.services.reduce((acc, service) => {
      const base = parseFloat(service.taxBase) || 0;
      const quantity = parseFloat(service.quantity) || 0;
      const discount = parseFloat(service.discount) || 0;
      const ivaPercent = parseFloat(service.iva) || 0;

      const subtotal = base * quantity;
      const discountAmount = subtotal * (discount / 100);
      const taxableAmount = subtotal - discountAmount;
      const ivaAmount = taxableAmount * (ivaPercent / 100);

      return acc + taxableAmount + ivaAmount;
    }, 0);
    updateData.totalAmount = parseFloat(updateData.totalAmount.toFixed(2));
  }

  if (updateData.status === "Paid") {
    updateData.balanceDue = 0;
  } else if (updateData.totalAmount !== undefined) {
    updateData.balanceDue = updateData.totalAmount;
  }

  const filter =
    userType === "Admin" || userType === "SuperAdmin"
      ? { _id: id }
      : { _id: id, userId };

  const bill = await Bill.findOneAndUpdate(filter, updateData, {
    new: true,
  });
  return bill;
};

const deleteBill = async (id, userId, userType) => {
  const filter =
    userType === "Admin" || userType === "SuperAdmin"
      ? { _id: id }
      : { _id: id, userId };
  const bill = await Bill.findOneAndDelete(filter);
  if (!bill) {
    throw new Error("Bill not found");
  }
  return bill;
};

const getNextBillNumber = async (serie) => {
  const lastBill = await Bill.findOne({ serie })
    .sort({ billNumber: -1 })
    .collation({ locale: "en_US", numericOrdering: true });

  if (lastBill && lastBill.billNumber) {
    return lastBill.billNumber + 1;
  }
  return 1;
};

module.exports = {
  getAllBills,
  createBill,
  getBillById,
  updateBill,
  deleteBill,
  getNextBillNumber,
};
