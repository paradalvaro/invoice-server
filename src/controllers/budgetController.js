const budgetService = require("../services/budgetService");
const pdfService = require("../services/pdfService");

const getBudgets = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy,
      order,
      search,
      searchField,
      status,
    } = req.query;
    const result = await budgetService.getAllBudgets(
      req.user.id,
      req.user.type,
      page,
      limit,
      sortBy,
      order,
      search,
      searchField,
      status
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createBudget = async (req, res) => {
  try {
    const budgetData = { ...req.body, userId: req.user.id };
    const budget = await budgetService.createBudget(budgetData);
    res.status(201).json(budget);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

const getBudget = async (req, res) => {
  try {
    const budget = await budgetService.getBudgetById(
      req.params.id,
      req.user.id,
      req.user.type
    );
    res.json(budget);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const updateBudget = async (req, res) => {
  try {
    const budget = await budgetService.updateBudget(
      req.params.id,
      req.user.id,
      req.user.type,
      req.body
    );
    res.json(budget);
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const deleteBudget = async (req, res) => {
  try {
    await budgetService.deleteBudget(req.params.id, req.user.id, req.user.type);
    res.json({ message: "Budget removed" });
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

const getNextNumber = async (req, res) => {
  try {
    const { serie } = req.query;
    const nextNumber = await budgetService.getNextBudgetNumber(serie);
    res.json({ nextNumber });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const generatePdf = async (req, res) => {
  try {
    const budget = await budgetService.getBudgetById(
      req.params.id,
      req.user.id,
      req.user.type
    );

    const stream = res.writeHead(200, {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment;filename=budget-${budget.serie || ""}${
        budget.budgetNumber || ""
      }.pdf`,
    });

    pdfService.buildBudgetPDF(
      budget,
      (chunk) => stream.write(chunk),
      () => stream.end()
    );
  } catch (err) {
    res.status(404).json({ message: err.message });
  }
};

module.exports = {
  getBudgets,
  createBudget,
  getBudget,
  updateBudget,
  deleteBudget,
  getNextNumber,
  generatePdf,
};
