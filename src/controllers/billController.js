const billService = require("../services/billService");

const getBills = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy,
      order,
      search,
      searchField,
      status,
      dueDateRange,
    } = req.query;
    const result = await billService.getAllBills(
      req.user.id,
      req.user.type,
      page,
      limit,
      sortBy,
      order,
      search,
      searchField,
      status,
      dueDateRange,
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createBill = async (req, res) => {
  try {
    const billData = { ...req.body, userId: req.user.id };
    const bill = await billService.createBill(billData);
    res.status(201).json(bill);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getBill = async (req, res) => {
  try {
    const bill = await billService.getBillById(
      req.params.id,
      req.user.id,
      req.user.type,
    );
    res.json(bill);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const updateBill = async (req, res) => {
  try {
    const bill = await billService.updateBill(
      req.params.id,
      req.user.id,
      req.user.type,
      req.body,
    );
    res.json(bill);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const deleteBill = async (req, res) => {
  try {
    await billService.deleteBill(req.params.id, req.user.id, req.user.type);
    res.json({ message: "Bill removed" });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const getNextNumber = async (req, res) => {
  try {
    const { serie } = req.query;
    const nextNumber = await billService.getNextBillNumber(serie);
    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = {
  getBills,
  createBill,
  getBill,
  updateBill,
  deleteBill,
  getNextBillNumber: getNextNumber,
};
