const PDFDocument = require("pdfkit");
const QRCode = require("qrcode");
const nodemailer = require("nodemailer");
const path = require("path");

const email = process.env.EMAIL;
const password = process.env.PASSWORD;

// Helper to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat("es-ES", {
    style: "decimal",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

// Helper to format date
const formatDate = (date) => {
  if (!date) return "";
  return new Date(date).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const buildPDF = async (invoice, dataCallback, endCallback) => {
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  doc.on("data", dataCallback);
  doc.on("end", endCallback);

  // --- Header Section ---

  // QR Code in superior right corner
  try {
    const qrData = JSON.stringify({
      nifEmisor: "B00000000",
      numeroFactura: `${invoice.serie}${invoice.invoiceNumber}`,
      fechaExpedicion: invoice.date,
      importeTotal: invoice.totalAmount,
      tipoFactura: invoice.type || "F1",
      hash: invoice.hash,
    });
    const qrBuffer = await QRCode.toBuffer(qrData, { margin: 1 });
    doc.image(qrBuffer, 460, 45, { width: 85 });
  } catch (error) {
    console.error("Error generating QR code:", error);
  }

  // Logo
  // Assuming the process is running from the server root, so we go up to find client/public
  // Workspace root: d:\Proyectos Ramiro\Proyecto Facturas
  // Server root: d:\Proyectos Ramiro\Proyecto Facturas\server
  // Image path: d:\Proyectos Ramiro\Proyecto Facturas\client\public\VerSalIT-bg.png
  // So from server/src/services (where this file is ideally), we go: ../../../client/public
  // But process.cwd() is likely the server root "d:\Proyectos Ramiro\Proyecto Facturas\server" or just "d:\Proyectos Ramiro\Proyecto Facturas" depending on how it's started.
  // Reliable way: try absolute path based on known structure or relative to __dirname.
  const logoPath = path.resolve(__dirname, "../../public/VerSalIT-bg.png");

  try {
    doc.image(logoPath, 50, 45, { width: 150 });
  } catch (err) {
    console.warn("Logo not found at:", logoPath);
    // Fallback text if logo missing
    doc.fontSize(20).text("VerSalIT", 50, 45);
  }

  doc.moveDown(4);

  // Title
  doc.fontSize(16).font("Helvetica-Bold").text("Ventas - Factura", 50, 150);
  doc.fontSize(10).font("Helvetica").text("Página 1 de 1", 50, 170);

  // Client Info Box (Right side)
  const clientX = 350;
  let clientY = 150;
  doc
    .fontSize(14)
    .font("Helvetica")
    .text(invoice.clientName || "ALVARO PARADA", clientX, clientY);

  clientY += 20;
  doc.fontSize(10).font("Helvetica");

  if (invoice.client && typeof invoice.client === "object") {
    const { address, postalCode, city, country } = invoice.client;
    if (address) {
      doc.text(address, clientX, clientY);
      // Estimate lines in address to properly offset next fields
      const lines = address.split("\n").length;
      clientY += 15 * lines;
    }
    if (postalCode || city) {
      doc.text(`${postalCode || ""} ${city || ""}`.trim(), clientX, clientY);
      clientY += 15;
    }
    // Note: The picture shows "Madrid" then "España".
    // If city is "Loeches", maybe city is "28890 Loeches".
    // If the model doesn't have a province field, we'll just output what's there.
    if (country) {
      doc.text(country, clientX, clientY);
      clientY += 15;
    }
  } else if (invoice.clientAddress) {
    doc.text(invoice.clientAddress, clientX, clientY);
  }

  // NIF
  // The picture shows "CIF/NIF B00000000" aligned below the address section.
  // We'll place it slightly below the address block.
  doc.text(
    `CIF/NIF    ${invoice.clientNIF || ""}`,
    clientX,
    Math.max(clientY + 20, 230)
  );

  // --- Invoice Details (Left side) ---
  const leftX = 50;
  let currentY = 220;
  const col1Width = 150;

  // Helper for rows
  const addDetailRow = (label, value) => {
    doc.fillColor("black").font("Helvetica").text(label, leftX, currentY);
    doc.font("Helvetica-Bold").text(value, leftX + col1Width, currentY);
    currentY += 15;
  };

  doc.fontSize(10);

  // Factura-a Nº cliente: 0000 (Placeholder or client ID)
  addDetailRow("Factura-a Nº cliente", "0000"); // Don't have client ID in Invoice model directly easily visible without populate. Using 0000 as placeholder like image.

  // Nº factura: invoice.serie + invoice.invoiceNumber
  addDetailRow("Nº factura", `${invoice.serie}${invoice.invoiceNumber}`);

  // Nº pedido: XX0000000 (Placeholder or order number)
  addDetailRow("Nº pedido", "XX0000000");

  // Nº de documento externo: 000000
  addDetailRow("Nº de documento externo", "000000");

  // Fecha registro: invoice.date
  addDetailRow("Fecha registro", formatDate(invoice.date));

  // Fecha vencimiento: invoice.dueDate
  addDetailRow("Fecha vencimiento", formatDate(invoice.dueDate));

  // Términos de pago: (dueDate - date) in days
  let paymentTerms = "0 días";
  if (invoice.dueDate && invoice.date) {
    const diffTime = Math.abs(
      new Date(invoice.dueDate) - new Date(invoice.date)
    );
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    paymentTerms = `${diffDays} días`;
  }
  addDetailRow("Términos de pago", paymentTerms);

  // Forma pago: "Transferencia"
  addDetailRow("Forma pago", "Transferencia");

  // --- Services Table ---
  const tableTop = 350; // Adjust as needed
  const itemCodeX = 50; // Cantidad? No, Header says "Cantidad"
  // Picture headers: Cantidad | Nº | Descripción | Precio venta | % Descuento | Importe

  // Columns positions
  const posQty = 50;
  const posNo = 95; // "Nº" column
  const posDesc = 130;
  const posPrice = 330;
  const posDisc = 405;
  const posTotal = 475;
  const colWidth = 70;

  doc.font("Helvetica-Bold").fontSize(9);
  currentY = tableTop;

  // Draw Header Line
  doc
    .moveTo(50, currentY + 22)
    .lineTo(550, currentY + 22)
    .stroke();

  doc.text("Cantidad", posQty, currentY);
  doc.text("Nº", posNo, currentY);
  doc.text("Descripción", posDesc, currentY);

  // Multi-line headers aligned
  doc.text("Precio", posPrice, currentY, { width: colWidth, align: "right" });
  doc.text("venta", posPrice, currentY + 10, {
    width: colWidth,
    align: "right",
  });

  doc.text("%", posDisc, currentY, { width: colWidth, align: "right" });
  doc.text("Descuento", posDisc, currentY + 10, {
    width: colWidth,
    align: "right",
  });

  doc.text("Importe", posTotal, currentY + 10, {
    width: colWidth + 5,
    align: "right",
  });

  currentY += 30; // Move down below header
  doc.font("Helvetica").fontSize(9);

  // Rows
  let totalImporteExcl = 0;
  let totalIvaAmount = 0;

  if (invoice.services && invoice.services.length > 0) {
    invoice.services.forEach((service, index) => {
      const qty = service.quantity || 1;
      const price = service.taxBase; // "Precio venta"
      const discountPercent = service.discount || 0;

      const subtotal = price * qty;
      const discountAmount = subtotal * (discountPercent / 100);
      const taxableAmount = subtotal - discountAmount; // This is "Importe"

      const ivaPercent = service.iva || 21;
      const ivaAmount = taxableAmount * (ivaPercent / 100);

      totalImporteExcl += taxableAmount;
      totalIvaAmount += ivaAmount;

      doc.text(qty.toString(), posQty, currentY);
      doc.text((index + 1).toString(), posNo, currentY);

      doc.text(service.concept, posDesc, currentY, { width: 190 });

      doc.text(formatCurrency(price), posPrice, currentY, {
        width: colWidth,
        align: "right",
      });
      doc.text(formatCurrency(discountPercent), posDisc, currentY, {
        width: colWidth,
        align: "right",
      });
      doc.text(formatCurrency(taxableAmount), posTotal, currentY, {
        width: colWidth + 5,
        align: "right",
      });

      currentY += 20; // Next row
    });
  }

  // --- Totals Section ---
  currentY += 20;
  const labelWidth = 160;
  const valueWidth = 80;
  const labelsX = 300;
  const valuesX = 470; // labelsX + labelWidth + small gap = 460? Let's use 470 to align with Importe column.

  // Actually, let's align valuesX with the "Importe" column right edge.
  // posTotal was 500, width 50 -> 550.
  // So valuesX = 470, width 80 -> 550.

  doc.font("Helvetica-Bold");

  doc.text("Total EUR IVA excl.", labelsX, currentY, {
    width: labelWidth,
    align: "right",
  });
  doc.text(formatCurrency(totalImporteExcl), valuesX, currentY, {
    width: valueWidth,
    align: "right",
  });

  currentY += 15;
  doc.font("Helvetica");
  doc.text("Importe IVA", labelsX, currentY, {
    width: labelWidth,
    align: "right",
  });
  doc.text(formatCurrency(totalIvaAmount), valuesX, currentY, {
    width: valueWidth,
    align: "right",
  });

  currentY += 20;
  doc.font("Helvetica-Bold");
  doc.text("Total EUR IVA incl.", labelsX, currentY, {
    width: labelWidth,
    align: "right",
  });
  doc.text(formatCurrency(invoice.totalAmount), valuesX, currentY, {
    width: valueWidth,
    align: "right",
  });

  // --- Footer ---
  // Legal text (GDPR) positioned relatively below the totals
  doc.fontSize(6).font("Helvetica").fillColor("grey");
  doc.text(
    invoice.legalText ||
      "Responsable del tratamiento: VerSal-IT: B00000000 Dirección: Avenida Barcelona, 14010 Córdoba Correo electrónico: info@versal-it.es | Finalidades: la emisión de facturas para el cobro de los servicios prestados y/o realización del presupuesto ajustado a sus necesidades | Legitimación: por ser los datos necesarios para la ejecución de un contrato en el que el interesado es parte o por relación precontractual (art. 6.1.b RGPD) procediendo éstos del propio interesado titular de los mismos. | Conservación de los datos: sus datos se conservarán el tiempo estrictamente necesario y por los plazos legales de conservación (4, 6 o 10 años, según el caso). Puede consultar los plazos de conservación en nuestra política de privacidad en info@versal-it.es / https://versal-it.com/ | Destinatarios: sus datos no serán cedidos a ninguna empresa, salvo obligación legal. | Derechos: puede acceder, rectificar y suprimir los datos, así como el resto de derechos que le asisten, como se explica en la información adicional. | Información adicional: puede consultar la información adicional y detallada sobre protección de Datos en info@versal-it.es / https://versal-it.com/ o solicitando más información en nuestra oficina sita en la dirección indicada en el apartado “Responsable del Tratamiento”. Si considera que sus derechos han sido vulnerados, puede interponer una reclamación ante la AEPD.",
    50,
    currentY + 20,
    { width: 500, align: "justify" }
  );

  const pageHeight = doc.page.height;
  const bottomMargin = 50;

  // Bank Info Footer (Bottom of page)
  const bankInfoY = pageHeight - bottomMargin - 45; // Around 746
  doc.fontSize(8).fillColor("black");

  // Left: Company Info
  doc.font("Helvetica-Bold").text("VerSal-IT", 50, bankInfoY);
  doc.font("Helvetica").fontSize(7);
  doc.text("Avenida Barcelona", 50, bankInfoY + 10);
  doc.text("14010 Córdoba", 50, bankInfoY + 18);
  doc.text("info@versal-it.es | https://versal-it.com/", 50, bankInfoY + 26);

  // Center: Registry Info
  doc.font("Helvetica-Bold").text("NIF: B00000000", 250, bankInfoY);
  doc.font("Helvetica").fontSize(7);
  doc.text("Tomo: 00000, Libro: 0, Folio: 000", 250, bankInfoY + 10);
  doc.text("Sección: 0 Hoja: X 000000", 250, bankInfoY + 18);
  doc.text("Inscripción 0", 250, bankInfoY + 26);

  // Right: Bank Info
  doc.font("Helvetica-Bold").text("Banco: BBVA", 430, bankInfoY);
  doc.font("Helvetica").fontSize(7);
  doc.text("IBAN: ES0000000000000000000000", 430, bankInfoY + 10);
  doc.text("SWIFT: XXXXXXXX", 430, bankInfoY + 18);

  // --- QR Code (Optional/Preserved from old implementation but moved?) ---
  // If we want it, we can put it in. The user request didn't explicitly forbid it, but wanted "like the picture".
  // The picture doesn't show a QR code. I will omit it to match the picture "exactly" as requested.
  // Wait, if I strictly follow "most be like the picture", I should probably omit the QR code if it's not visible.
  // The user said "the generated pdf most be like the picture".
  // I will skip the QR code generation to keep it clean like the reference.

  doc.end();
};

const sendPDFInvoiceByEmail = async (pdfBuffer, invoice, emails) => {
  const transporter = nodemailer.createTransport({
    //host: process.env.SMTP_HOST,
    //port: process.env.SMTP_PORT,
    //secure: true,
    service: "gmail",
    auth: {
      user: email, //process.env.EMAIL_USER,
      pass: password, //process.env.EMAIL_PASS
    },
  });

  const mailOptions = {
    from: email,
    to: emails || email,
    subject: `Factura ${invoice.serie}${invoice.invoiceNumber} generada`,
    text: "Adjunto encontrará su factura en formato PDF.",
    //html: '<b>PDF Invoice</b><p>PDF Invoice</p>',
    attachments: [
      {
        filename: `Factura_${invoice.serie}${invoice.invoiceNumber}.pdf`,
        content: pdfBuffer, // Pasamos el buffer directamente de la memoria
      },
    ],
  };

  // 3. Enviar el correo
  try {
    const info = await transporter.sendMail(mailOptions);
    console.log("Correo enviado con éxito: %s", info.messageId);
    return info;
  } catch (error) {
    console.error("Error al enviar el correo:", error);
    throw error;
  }
};
const buildBudgetPDF = async (budget, dataCallback, endCallback) => {
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  doc.on("data", dataCallback);
  doc.on("end", endCallback);

  // --- Header Section ---

  // Logo
  const logoPath = path.resolve(__dirname, "../../public/VerSalIT-bg.png");
  try {
    doc.image(logoPath, 50, 45, { width: 150 });
  } catch (err) {
    console.warn("Logo not found at:", logoPath);
    doc.fontSize(20).text("VerSalIT", 50, 45);
  }

  doc.moveDown(4);

  // Title & Page
  doc.fontSize(16).font("Helvetica-Bold").text("Oferta venta", 50, 150);
  doc.fontSize(10).font("Helvetica").text("Página 1 de 1", 50, 170);

  // Client Info Box (Right side)
  const clientX = 350;
  let clientY = 150;

  if (budget.client && typeof budget.client === "object") {
    // Client Name
    doc
      .fontSize(14)
      .font("Helvetica") // Match invoice font weight for consistency
      .text(budget.client.name, clientX, clientY);
    clientY += 20;

    doc.fontSize(10).font("Helvetica");

    // Address
    if (budget.client.address) {
      doc.text(budget.client.address, clientX, clientY);
      clientY += 15;
    }
    // CP / City
    if (budget.client.postalCode || budget.client.city) {
      doc.text(
        `${budget.client.postalCode || ""} ${budget.client.city || ""}`.trim(),
        clientX,
        clientY
      );
      clientY += 15;
    }
    // Province
    if (budget.client.province) {
      doc.text(budget.client.province, clientX, clientY);
      clientY += 15;
    }
    // Country
    if (budget.client.country) {
      doc.text(budget.client.country, clientX, clientY);
      clientY += 15;
    }

    clientY += 15;
    // A/A: Creator Name
    const creatorName =
      (budget.userId &&
        `${budget.userId.name} ${budget.userId.lastName || ""}`) ||
      "VerSalIT";
    doc.text(`A/A: ${creatorName.trim()}`, clientX, clientY);
    clientY += 20;
  } else if (budget.clientName) {
    doc
      .fontSize(14)
      .font("Helvetica")
      .text(budget.clientName, clientX, clientY);
  }

  // --- Budget Details (Left side) ---
  const leftX = 50;
  let currentY = 200;
  const col1Width = 150;

  const addDetailRow = (label, value) => {
    doc.fillColor("black").font("Helvetica").text(label, leftX, currentY);
    doc.font("Helvetica-Bold").text(value, leftX + col1Width, currentY);
    currentY += 15;
  };

  doc.fontSize(10);
  addDetailRow("Fecha emisión documento", formatDate(budget.date));
  addDetailRow("Nº", `${budget.serie || ""}${budget.budgetNumber || ""}`);

  const creatorName =
    (budget.userId &&
      `${budget.userId.name} ${budget.userId.lastName || ""}`) ||
    "VerSalIT";
  addDetailRow("Comercial", creatorName.trim());
  addDetailRow("Plazo de entrega", "a confirmar");

  const paymentTermsText =
    budget.paymentTerms === "Manual"
      ? budget.paymentTermsManual
      : budget.paymentTerms === "1 day"
      ? "1 día"
      : budget.paymentTerms === "7 days"
      ? "7 días"
      : budget.paymentTerms === "15 days"
      ? "15 días"
      : budget.paymentTerms === "30 days"
      ? "30 días"
      : budget.paymentTerms === "45 days"
      ? "45 días"
      : budget.paymentTerms === "60 days"
      ? "60 días"
      : budget.paymentTerms || "1 día";

  addDetailRow("Términos pago", paymentTermsText);
  addDetailRow("Condiciones envío", "Portes Pagados");

  const validUntil = new Date(budget.date);
  validUntil.setMonth(validUntil.getMonth() + 1);
  addDetailRow("Válido hasta", formatDate(validUntil));

  // --- Services Table ---
  const tableTop = 350;
  const posQty = 50;
  const posNo = 95;
  const posDesc = 130;
  const posPrice = 330;
  const posDisc = 405;
  const posTotal = 475;
  const colWidth = 70;

  doc.font("Helvetica-Bold").fontSize(9);
  currentY = tableTop;

  // Draw Header Line
  doc
    .moveTo(50, currentY + 22)
    .lineTo(550, currentY + 22)
    .stroke();

  doc.text("Cantidad", posQty, currentY);
  doc.text("Nº", posNo, currentY);
  doc.text("Descripción", posDesc, currentY);

  doc.text("Precio", posPrice, currentY, { width: colWidth, align: "right" });
  doc.text("venta", posPrice, currentY + 10, {
    width: colWidth,
    align: "right",
  });

  doc.text("%", posDisc, currentY, { width: colWidth, align: "right" });
  doc.text("Descuento", posDisc, currentY + 10, {
    width: colWidth,
    align: "right",
  });

  doc.text("Importe", posTotal, currentY + 10, {
    width: colWidth + 5,
    align: "right",
  });

  currentY += 30;
  doc.font("Helvetica").fontSize(9);

  let totalImporteExcl = 0;
  let totalIvaAmount = 0;

  if (budget.services && budget.services.length > 0) {
    budget.services.forEach((service, index) => {
      const qty = service.quantity || 1;
      const price = service.taxBase;
      const discountPercent = service.discount || 0;

      const subtotal = price * qty;
      const discountAmount = subtotal * (discountPercent / 100);
      const taxableAmount = subtotal - discountAmount;

      const ivaPercent = service.iva || 21;
      const ivaAmount = taxableAmount * (ivaPercent / 100);

      totalImporteExcl += taxableAmount;
      totalIvaAmount += ivaAmount;

      doc.text(qty.toString(), posQty, currentY);
      doc.text((index + 1).toString(), posNo, currentY);
      doc.text(service.concept, posDesc, currentY, { width: 190 });

      doc.text(formatCurrency(price), posPrice, currentY, {
        width: colWidth,
        align: "right",
      });
      doc.text(formatCurrency(discountPercent), posDisc, currentY, {
        width: colWidth,
        align: "right",
      });
      doc.text(formatCurrency(taxableAmount), posTotal, currentY, {
        width: colWidth + 5,
        align: "right",
      });

      const textHeight = doc.heightOfString(service.concept, { width: 190 });
      currentY += Math.max(textHeight, 15) + 5;
    });
  }

  // --- Totals Section ---
  currentY += 20;
  const labelWidth = 160;
  const valueWidth = 80;
  const labelsX = 300;
  const valuesX = 470;

  doc.font("Helvetica-Bold");

  doc.text("Total EUR IVA excl.", labelsX, currentY, {
    width: labelWidth,
    align: "right",
  });
  doc.text(formatCurrency(totalImporteExcl), valuesX, currentY, {
    width: valueWidth,
    align: "right",
  });

  currentY += 15;
  doc.font("Helvetica");
  doc.text("Importe IVA", labelsX, currentY, {
    width: labelWidth,
    align: "right",
  });
  doc.text(formatCurrency(totalIvaAmount), valuesX, currentY, {
    width: valueWidth,
    align: "right",
  });

  currentY += 20;
  doc.font("Helvetica-Bold");
  doc.text("Total EUR IVA incl.", labelsX, currentY, {
    width: labelWidth,
    align: "right",
  });
  doc.text(formatCurrency(budget.totalAmount), valuesX, currentY, {
    width: valueWidth,
    align: "right",
  });

  // --- Footer ---
  const pageHeight = doc.page.height;
  const bottomMargin = 50;

  // Legal text (GDPR)
  doc.fontSize(6).font("Helvetica").fillColor("grey");
  doc.text(
    "Responsable del tratamiento: VerSalIT SL CIF: B00000000 Dirección: Avenida Barcelona, 14010 Córdoba Correo electrónico: info@versal-it.es | Finalidades: la emisión de facturas para el cobro de los servicios prestados y/o realización del presupuesto ajustado a sus necesidades | Legitimación: por ser los datos necesarios para la ejecución de un contrato en el que el interesado es parte o por relación precontractual (art. 6.1.b RGPD) procediendo éstos del propio interesado titular de los mismos. | Conservación de los datos: sus datos se conservarán el tiempo estrictamente necesario y por los plazos legales de conservación (4, 6 o 10 años, según el caso). | Destinatarios: sus datos no serán cedidos a ninguna empresa, salvo obligación legal. | Derechos: puede acceder, rectificar y suprimir los datos, así como el resto de derechos que le asisten, como se explica en la información adicional. | Información adicional: puede consultar la información adicional y detallada sobre protección de Datos en info@versal-it.es o solicitando más información en nuestra oficina sita en la dirección indicada en el apartado “Responsable del Tratamiento”.",
    50,
    pageHeight - 160,
    { width: 500, align: "justify" }
  );

  // Bank Info Footer
  const bankInfoY = pageHeight - bottomMargin - 45;
  doc.fontSize(8).fillColor("black");

  doc.font("Helvetica-Bold").text("VerSal-IT", 50, bankInfoY);
  doc.font("Helvetica").fontSize(7);
  doc.text("Avenida Barcelona", 50, bankInfoY + 10);
  doc.text("14010 Córdoba", 50, bankInfoY + 18);
  doc.text("info@versal-it.es | https://versal-it.com/", 50, bankInfoY + 26);

  doc.font("Helvetica-Bold").text("NIF: B00000000", 250, bankInfoY);
  doc.font("Helvetica").fontSize(7);
  doc.text("Tomo: 00000, Libro: 0, Folio: 0", 250, bankInfoY + 10);
  doc.text("Sección: 0 Hoja: X 000000", 250, bankInfoY + 18);
  doc.text("Inscripción 0", 250, bankInfoY + 26);

  doc.font("Helvetica-Bold").text("Banco: BBVA", 430, bankInfoY);
  doc.font("Helvetica").fontSize(7);
  doc.text("IBAN: ES0000000000000000000000", 430, bankInfoY + 10);
  doc.text("SWIFT: BBVAESMM", 430, bankInfoY + 18);

  doc.end();
};

module.exports = { buildPDF, buildBudgetPDF, sendPDFInvoiceByEmail };
