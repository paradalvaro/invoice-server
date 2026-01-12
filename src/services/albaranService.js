const mongoose = require("mongoose");
const Albaran = require("../models/Albaran");

const getAllAlbaranes = async (
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

  // General Search Filter
  if (search) {
    const allowedFields = ["AlbaranNumber", "status", "date"];
    const field = allowedFields.includes(searchField) ? searchField : "status";

    if (field === "date") {
      const startDate = new Date(search);
      const endDate = new Date(search);
      endDate.setDate(endDate.getDate() + 1);

      if (!isNaN(startDate.getTime())) {
        filter[field] = { $gte: startDate, $lt: endDate };
      }
    } else if (field === "AlbaranNumber") {
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

  const albaranes = await Albaran.find(filter)
    .skip(skip)
    .limit(limit)
    .sort(sortOptions)
    .populate("userId", "username name lastName")
    .populate("client");

  const totalItems = await Albaran.countDocuments(filter);
  const totalPages = Math.ceil(totalItems / limit);

  return {
    data: albaranes,
    currentPage: Number(page),
    totalPages,
    totalItems,
  };
};

const createAlbaran = async (albaranData) => {
  const albaran = new Albaran(albaranData);
  return await albaran.save();
};

const getAlbaranById = async (id, userId, userType) => {
  const filter =
    userType === "Admin" || userType === "SuperAdmin"
      ? { _id: id }
      : { _id: id, userId };
  const albaran = await Albaran.findOne(filter)
    .populate("client")
    .populate("userId", "username name lastName");
  if (!albaran) {
    throw new Error("Albaran not found");
  }
  return albaran;
};

const updateAlbaran = async (id, userId, userType, updateData) => {
  const filter =
    userType === "Admin" || userType === "SuperAdmin"
      ? { _id: id }
      : { _id: id, userId };

  const albaran = await Albaran.findOneAndUpdate(filter, updateData, {
    new: true,
    runValidators: true,
  })
    .populate("client")
    .populate("userId", "username name lastName");

  if (!albaran) {
    throw new Error("Albaran not found");
  }
  return albaran;
};

const deleteAlbaran = async (id, userId, userType) => {
  const filter =
    userType === "Admin" || userType === "SuperAdmin"
      ? { _id: id }
      : { _id: id, userId };
  const albaran = await Albaran.findOneAndDelete(filter);
  if (!albaran) {
    throw new Error("Albaran not found");
  }
  return albaran;
};

const getNextAlbaranNumber = async (serie) => {
  if (!serie) return 1;
  const lastAlbaran = await Albaran.findOne({ serie })
    .sort({ AlbaranNumber: -1 })
    .collation({ locale: "en_US", numericOrdering: true });

  if (lastAlbaran && lastAlbaran.AlbaranNumber) {
    return lastAlbaran.AlbaranNumber + 1;
  }
  return 1;
};

module.exports = {
  getAllAlbaranes,
  createAlbaran,
  getAlbaranById,
  updateAlbaran,
  deleteAlbaran,
  getNextAlbaranNumber,
};
