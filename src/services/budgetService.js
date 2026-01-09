const mongoose = require("mongoose");
const Budget = require("../models/Budget");

const getAllBudgets = async (
  userId,
  userType,
  page = 1,
  limit = 10,
  sortBy = "date",
  order = "desc",
  search = "",
  searchField = "clientName",
  status = ""
) => {
  const skip = (page - 1) * limit;

  const filter =
    userType === "Admin" || userType === "SuperAdmin" ? {} : { userId };

  if (filter.userId && typeof filter.userId === "string") {
    filter.userId = new mongoose.Types.ObjectId(filter.userId);
  }

  // Status Filter
  if (status) {
    filter.status = status;
  }

  // General Search Filter (simplified for Budget)
  if (search) {
    const allowedFields = ["budgetNumber", "status", "date"];
    // Note: clientName search in Invoice uses aggregation or specific field.
    // Budget model currently doesn't have clientName string, only client ObjectId.
    // For simplicity, sticking to BudgetNumber and Status for now unless I implement complex population search.
    const field = allowedFields.includes(searchField) ? searchField : "status";

    if (field === "date") {
      const startDate = new Date(search);
      const endDate = new Date(search);
      endDate.setDate(endDate.getDate() + 1);

      if (!isNaN(startDate.getTime())) {
        filter[field] = { $gte: startDate, $lt: endDate };
      }
    } else if (field === "budgetNumber") {
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

  const budgets = await Budget.find(filter)
    .skip(skip)
    .limit(limit)
    .sort(sortOptions)
    .populate("userId", "username name lastName")
    .populate("client");

  const totalItems = await Budget.countDocuments(filter);
  const totalPages = Math.ceil(totalItems / limit);

  return {
    data: budgets,
    currentPage: Number(page),
    totalPages,
    totalItems,
  };
};

const createBudget = async (budgetData) => {
  const budget = new Budget(budgetData);
  return await budget.save();
};

const getBudgetById = async (id, userId, userType) => {
  const filter =
    userType === "Admin" || userType === "SuperAdmin"
      ? { _id: id }
      : { _id: id, userId };
  const budget = await Budget.findOne(filter)
    .populate("client")
    .populate("userId", "username name lastName");
  if (!budget) {
    throw new Error("Budget not found");
  }
  return budget;
};

const updateBudget = async (id, userId, userType, updateData) => {
  const filter =
    userType === "Admin" || userType === "SuperAdmin"
      ? { _id: id }
      : { _id: id, userId };
  // Model pre-validate handles totalAmount recalculation
  const budget = await Budget.findOneAndUpdate(filter, updateData, {
    new: true,
    runValidators: true,
  })
    .populate("client")
    .populate("userId", "username name lastName");
  if (!budget) {
    throw new Error("Budget not found");
  }
  return budget;
};

const deleteBudget = async (id, userId, userType) => {
  const filter =
    userType === "Admin" || userType === "SuperAdmin"
      ? { _id: id }
      : { _id: id, userId };
  const budget = await Budget.findOneAndDelete(filter);
  if (!budget) {
    throw new Error("Budget not found");
  }
  return budget;
};

const getNextBudgetNumber = async (serie) => {
  if (!serie) return 1;
  const lastBudget = await Budget.findOne({ serie })
    .sort({ budgetNumber: -1 })
    .collation({ locale: "en_US", numericOrdering: true });

  if (lastBudget && lastBudget.budgetNumber) {
    return lastBudget.budgetNumber + 1;
  }
  return 1;
};

module.exports = {
  getAllBudgets,
  createBudget,
  getBudgetById,
  updateBudget,
  deleteBudget,
  getNextBudgetNumber,
};
