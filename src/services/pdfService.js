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
const formatDate = (date, timezone = "Europe/Madrid") => {
  if (!date) return "";
  const d = new Date(date);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const buildPDF = async (
  invoice,
  dataCallback,
  endCallback,
  timezone = "Europe/Madrid"
) => {
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
  addDetailRow(
    "Factura-a Nº cliente",
    invoice.client?.clientNumber
      ? invoice.client.clientNumber.toString().padStart(5, "0")
      : "00000"
  );

  // Nº factura: invoice.serie + invoice.invoiceNumber
  addDetailRow("Nº factura", `${invoice.serie}${invoice.invoiceNumber}`);

  // Nº pedido: invoice.orderNumber
  addDetailRow("Nº pedido", invoice.orderNumber || "");

  // Nº de documento externo: invoice.externalDocumentNumber
  addDetailRow("Nº de documento externo", invoice.externalDocumentNumber || "");

  // Fecha registro: invoice.date
  addDetailRow("Fecha registro", formatDate(invoice.date, timezone));

  // Fecha vencimiento: invoice.dueDate
  addDetailRow("Fecha vencimiento", formatDate(invoice.dueDate, timezone));

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

  // Forma pago: Use invoice payment method
  addDetailRow("Forma pago", invoice.paymentMethod || "Transferencia");

  // --- Services Table ---
  currentY = Math.max(currentY + 20, 320); // Relative to details, at least 320
  const posQty = 50;
  const posNo = 95;
  const posDesc = 130;
  const posPrice = 330;
  const posDisc = 405;
  const posTotal = 475;
  const colWidth = 70;

  doc.font("Helvetica-Bold").fontSize(9);

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
      doc.text((service.number || index + 1).toString(), posNo, currentY);

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
    currentY + 50,
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
const buildBudgetPDF = async (
  budget,
  dataCallback,
  endCallback,
  timezone = "Europe/Madrid"
) => {
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
  addDetailRow("Fecha emisión documento", formatDate(budget.date, timezone));
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
  addDetailRow("Válido hasta", formatDate(validUntil, timezone));

  // --- Services Table ---
  currentY = Math.max(currentY + 20, 320); // Relative to details, at least 320
  const tableTop = currentY;
  const posQty = 50;
  const posNo = 95;
  const posDesc = 130;
  const posPrice = 330;
  const posDisc = 405;
  const posTotal = 475;
  const colWidth = 70;

  doc.font("Helvetica-Bold").fontSize(9);

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
      doc.text((service.number || index + 1).toString(), posNo, currentY);
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
    "Responsable del tratamiento: VerSalIT SL CIF: B00000000 Dirección: Avenida Barcelona, 14010 Córdoba Correo electrónico: info@versal-it.es | Finalidades: la emisión de facturas para el cobro de los servicios prestados y/o realización del presupuesto ajustado a sus necesidades | Legitimación: por ser los datos necesarios para la ejecución de un contrato en el que el interesado es parte o por relación precontractual (art. 6.1.b RGPD) procediendo éstos del propio interesado titular de los mismos. | Conservación de los datos: sus datos se conservarán el tiempo estrictamente necesario y por los plazos legales de conservación (4, 6 o 10 años, según el caso). | Destinatarios: sus datos no serán cedidos a ninguna empresa, salvo obligación legal. | Derechos: puede acceder, rectificar y suprimir los datos, así como el resto de derechos que le asisten, como se explica in la información adicional. | Información adicional: puede consultar la información adicional y detallada sobre protección de Datos en info@versal-it.es o solicitando más información en nuestra oficina sita en la dirección indicada en el apartado “Responsable del Tratamiento”.",
    50,
    currentY + 50,
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

const buildAlbaranPDF = async (
  albaran,
  dataCallback,
  endCallback,
  timezone = "Europe/Madrid"
) => {
  const doc = new PDFDocument({ margin: 50, size: "A4" });

  doc.on("data", dataCallback);
  doc.on("end", endCallback);

  // --- Header Section ---
  const logoPath = path.resolve(__dirname, "../../public/VerSalIT-bg.png");

  try {
    doc.image(logoPath, 50, 45, { width: 150 });
  } catch (err) {
    console.warn("Logo not found at:", logoPath);
    doc.fontSize(20).text("VerSalIT", 50, 45);
  }

  // Client Info Box (Right side)
  const clientX = 350;
  let clientY = 110;
  doc
    .fontSize(12)
    .font("Helvetica-Bold")
    .text(albaran.client?.name || "CLIENT NAME", clientX, clientY);

  clientY += 15;
  doc.fontSize(10).font("Helvetica");

  if (albaran.client && typeof albaran.client === "object") {
    const { address, postalCode, city, province, country, phone } =
      albaran.client;
    if (phone) {
      doc.text(`(${phone})`, clientX, clientY);
      clientY += 15;
    }
    if (address) {
      doc.text(address, clientX, clientY);
      const lines = address.split("\n").length;
      clientY += 15 * lines;
    }
    if (postalCode || city) {
      doc.text(`${postalCode || ""} ${city || ""}`.trim(), clientX, clientY);
      clientY += 15;
    }
    if (province) {
      doc.text(province, clientX, clientY);
      clientY += 15;
    }
    if (country) {
      doc.text(country, clientX, clientY);
      clientY += 15;
    }
  }

  // Title
  doc.fontSize(14).font("Helvetica-Bold").text("Venta - Alb. venta", 50, 150);
  doc.fontSize(10).font("Helvetica").text("Página 1 de 1", 50, 165);

  // --- Albaran Details (Left side) ---
  const leftX = 50;
  let currentY = 200;
  const col1Width = 150;

  const addDetailRow = (label, value) => {
    doc.fillColor("black").font("Helvetica").text(label, leftX, currentY);
    doc.font("Helvetica-Bold").text(value || "", leftX + col1Width, currentY);
    currentY += 15;
  };

  doc.fontSize(10);
  addDetailRow("Fecha emisión documento", formatDate(albaran.date, timezone));
  addDetailRow("Nº albarán", `${albaran.serie}${albaran.AlbaranNumber}`);
  addDetailRow("N.º pedido compra", albaran.orderNumber);
  addDetailRow("Nuestro n.º documento", albaran.ourDocumentNumber);

  // --- Services Table ---
  currentY += 20;
  const tableTop = currentY;
  const posQty = 50;
  const posNo = 200;
  const posDesc = 250;
  doc.font("Helvetica-Bold").fontSize(9);

  // Header Line
  doc
    .moveTo(50, currentY + 15)
    .lineTo(550, currentY + 15)
    .stroke();

  doc.text("Cantidad", posQty, currentY);
  doc.text("Nº", posNo, currentY);
  doc.text("Descripción", posDesc, currentY);

  currentY += 25;
  doc.font("Helvetica").fontSize(9);

  if (albaran.services && albaran.services.length > 0) {
    albaran.services.forEach((service, index) => {
      doc.text(service.quantity.toString(), posQty, currentY, {
        width: 50,
        align: "right",
      });
      doc.text((service.number || index + 1).toString(), posNo, currentY);
      doc.text(service.concept, posDesc, currentY, { width: 300 });
      const textHeight = doc.heightOfString(service.concept, { width: 300 });
      currentY += Math.max(textHeight, 15) + 5;
    });
  }

  // Shipping Address (Fact. a-Dirección)
  currentY += 30;
  doc.font("Helvetica-Bold").text("Fact. a-Dirección", leftX, currentY);
  currentY += 15;
  doc.font("Helvetica").fontSize(10);
  if (albaran.client && typeof albaran.client === "object") {
    const { name, address, postalCode, city, province, country } =
      albaran.client;
    doc.text(name || "", leftX, currentY);
    currentY += 12;
    if (address) {
      doc.text(address, leftX, currentY);
      const addrHeight = doc.heightOfString(address, { width: 300 }); // Width estimate
      currentY += Math.max(addrHeight, 12);
    }
    if (postalCode || city) {
      doc.text(`${postalCode || ""} ${city || ""}`.trim(), leftX, currentY);
      currentY += 12;
    }
    if (province) {
      doc.text(province, leftX, currentY);
      currentY += 12;
    }
    if (country) {
      doc.text(country, leftX, currentY);
      currentY += 12;
    }
  }

  // --- Footer ---
  const pageHeight = doc.page.height;
  const bottomMargin = 50;

  doc.fontSize(6).font("Helvetica").fillColor("grey");
  doc.text(
    "Responsable del tratamiento: VerSalIT SL CIF: B00000000 Dirección: Avenida Barcelona, 14010 Córdoba Correo electrónico: info@versal-it.es | Finalidades: la emisión de facturas para el cobro de los servicios prestados y/o realización del presupuesto ajustado a sus necesidades | Legitimación: por ser los datos necesarios para la ejecución de un contrato en el que el interesado es parte o por relación precontractual (art. 6.1.b RGPD) procediendo éstos del propio interesado titular de los mismos. | Conservación de los datos: sus datos se conservarán el tiempo estrictamente necesario y por los plazos legales de conservación (4, 6 o 10 años, según el caso). | Destinatarios: sus datos no serán cedidos a ninguna empresa, salvo obligación legal. | Derechos: puede acceder, rectificar y suprimir los datos, así como el resto de derechos que le asisten, como se explica en la información adicional. | Información adicional: puede consultar la información adicional y detallada sobre protección de Datos en info@versal-it.es o solicitando más información en nuestra oficina sita en la dirección indicada en el apartado “Responsable del Tratamiento”.",
    50,
    currentY + 50,
    { width: 500, align: "justify" }
  );

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

const buildModelo347PDF = async (
  data,
  dataCallback,
  endCallback,
  timezone = "Europe/Madrid"
) => {
  const doc = new PDFDocument({ margin: 20, size: "A4" });
  const { year, declarer, clients, summaryBoxes } = data;

  doc.on("data", dataCallback);
  doc.on("end", endCallback);

  const primaryColor = "#d69e46"; // Official orange-gold
  const lightBg = "#fdf9e1"; // Very light beige/yellow for backgrounds

  // --- Helpers ---
  const drawRoundedBox = (x, y, w, h, color = primaryColor, fill = false) => {
    doc.save();
    if (fill) {
      doc.roundedRect(x, y, w, h, 3).fillColor(color).fill();
    } else {
      doc.roundedRect(x, y, w, h, 3).lineWidth(1).strokeColor(color).stroke();
    }
    doc.restore();
  };

  const drawFieldLabel = (label, x, y, size = 6) => {
    doc
      .fillColor("black")
      .fontSize(size)
      .font("Helvetica-Bold")
      .text(label, x, y);
  };

  const drawSimpleInput = (
    x,
    y,
    w,
    h,
    val = "",
    align = "left",
    fontSize = 8
  ) => {
    doc
      .rect(x, y, w, h)
      .lineWidth(0.5)
      .strokeColor("#aaa")
      .fillColor("white")
      .fillAndStroke();
    if (val) {
      doc
        .fillColor("black")
        .fontSize(fontSize)
        .font("Helvetica")
        .text(val.toString(), x + 2, y + (h - fontSize) / 2 + 1, {
          width: w - 4,
          align,
        });
    }
    doc.fillColor("black");
  };

  const drawXCheckBox = (x, y, checked = false) => {
    doc
      .rect(x, y, 10, 10)
      .lineWidth(0.5)
      .strokeColor("black")
      .fillColor("white")
      .fillAndStroke();
    if (checked) {
      doc
        .fillColor("black")
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("X", x + 1.5, y + 1);
    }
    doc.fillColor("black");
  };

  const drawModelHeader = (pageNum, pageTitleSuffix = "") => {
    // Top Bar Layout
    // Left: Logo & Agency
    doc
      .fillColor("black")
      .font("Helvetica-Bold")
      .fontSize(14)
      .text("Agencia Tributaria", 30, 35);
    doc.fontSize(7).font("Helvetica").text("Teléfono: 901 33 55 33", 30, 52);
    doc.text("www.agenciatributaria.es", 30, 60);

    // Center-Right: Title Box
    const titleX = 185;
    const titleW = 345;
    doc.rect(titleX, 25, titleW, 45).fillColor(primaryColor).fill();
    doc.fillColor("white").font("Helvetica-Bold").fontSize(10);
    doc.text(
      "DECLARACIÓN ANUAL DE OPERACIONES CON TERCERAS PERSONAS",
      titleX + 10,
      32
    );
    doc.fontSize(8);
    if (!pageTitleSuffix) {
      doc.text("DECLARACIÓN", titleX + 10, 45);
      doc
        .fontSize(6)
        .text("REAL DECRETO 1065/2007, DE 27 DE JULIO", titleX + 10, 55);
    } else {
      doc.fontSize(14).text(pageTitleSuffix, titleX + 160, 35);
      doc
        .fontSize(7)
        .text(
          "HOJA COMÚN PARA TODAS LAS OPERACIONES (CLAVES A, B, C, D, E, F Y G)",
          titleX + 10,
          50
        );
    }

    // Far Right: Model/Page
    doc.rect(535, 10, 40, 15).fillColor(primaryColor).fill();
    doc.fillColor("white").fontSize(7).text(`Pág. ${pageNum}`, 540, 15);

    doc.rect(535, 25, 40, 45).fillColor("#e5e5e5").fill();
    doc.fillColor("black").fontSize(8).text("Modelo", 540, 35);
    doc.fontSize(16).text("347", 537, 50);
  };

  // --- Page 1 Rendering ---
  // --- Page 1 Header Redesign ---
  drawModelHeader(1);
  let startY = 80;

  // 1. Declarante (Left Box)
  const declBoxW = 310;
  const declBoxH = 100;

  // Tab Header "Declarante"
  doc
    .path(
      `M 20 ${startY} L 85 ${startY} Q 90 ${startY} 90 ${startY + 5} L 90 ${
        startY + 15
      } L 20 ${startY + 15} Z`
    )
    .fillColor(primaryColor)
    .fill();
  doc
    .fillColor("white")
    .fontSize(7)
    .text("Declarante", 25, startY + 4);

  // Main Box Declarante
  doc
    .rect(20, startY + 15, declBoxW, declBoxH)
    .fillColor(lightBg)
    .strokeColor(primaryColor)
    .fillAndStroke();

  // Dashed zone in Declarante
  doc.save();
  doc.dash(4, { space: 2 });
  doc
    .rect(30, startY + 25, declBoxW - 20, 80)
    .strokeColor("black")
    .stroke();
  doc.restore();

  doc.fillColor("black").fontSize(7).font("Helvetica");
  doc.text(
    "Espacio reservado para la etiqueta identificativa",
    35,
    startY + 55,
    { width: declBoxW - 30, align: "center" }
  );
  doc
    .fontSize(5)
    .text(
      "(si no dispone de etiquetas, haga constar a continuación sus datos identificativos)",
      35,
      startY + 65,
      { width: declBoxW - 30, align: "center" }
    );

  // 2. Space for ID and Barcode (Top Right)
  const rightColX = 20 + declBoxW + 15;
  const rightColW = 575 - rightColX;

  doc.save();
  doc.dash(4, { space: 2 });
  doc
    .rect(rightColX, startY + 5, rightColW, 45)
    .strokeColor("black")
    .stroke();
  doc.restore();
  doc
    .fillColor("black")
    .fontSize(7)
    .text(
      "Espacio reservado para número identificativo y código de barras",
      rightColX + 10,
      startY + 20,
      { width: rightColW - 20, align: "center" }
    );

  // 3. Ejercicio (Bottom Right)
  const ejerY = startY + 60;
  const ejerH = 55;

  // Tab Header "Ejercicio"
  doc
    .path(
      `M ${rightColX} ${ejerY} L ${rightColX + 65} ${ejerY} Q ${
        rightColX + 70
      } ${ejerY} ${rightColX + 70} ${ejerY + 5} L ${rightColX + 70} ${
        ejerY + 15
      } L ${rightColX} ${ejerY + 15} Z`
    )
    .fillColor(primaryColor)
    .fill();
  doc
    .fillColor("white")
    .fontSize(7)
    .text("Ejercicio", rightColX + 5, ejerY + 4);

  // Main Box Ejercicio
  doc
    .rect(rightColX, ejerY + 15, rightColW, ejerH)
    .fillColor(lightBg)
    .strokeColor(primaryColor)
    .fillAndStroke();

  doc
    .fillColor("black")
    .fontSize(8)
    .text(
      "Ejercicio .................................................",
      rightColX + 20,
      ejerY + 40
    );
  drawSimpleInput(
    rightColX + rightColW - 50,
    ejerY + 36,
    40,
    15,
    year,
    "center"
  );

  y = ejerY + 15 + ejerH + 10;

  // 4. Information Grid (Bottom Section)
  doc
    .rect(20, y, 555, 60)
    .fillColor(lightBg)
    .strokeColor(primaryColor)
    .fillAndStroke();

  // Row 1: NIF and Social Name
  drawFieldLabel("N.I.F.", 25, y + 5);
  drawSimpleInput(25, y + 13, 100, 15, declarer.nif);

  drawFieldLabel("Apellidos y nombre, razón social o denominación", 135, y + 5);
  drawSimpleInput(135, y + 13, 430, 15, declarer.name);

  // Row 2: Contact Phone and Contact Person
  drawFieldLabel("Teléfono de contacto", 25, y + 32);
  drawSimpleInput(25, y + 40, 100, 15, "900000000"); // Standard placeholder or update if available

  drawFieldLabel(
    "Apellidos y nombre de la persona con quien relacionarse",
    135,
    y + 32
  );
  drawSimpleInput(135, y + 40, 430, 15);

  y += 75;

  // Complementaria Section
  y += 35;
  doc.rect(20, y, 555, 15).fillColor(primaryColor).fill();
  doc
    .fillColor("white")
    .fontSize(9)
    .text("Declaración complementaria o sustitutiva", 25, y + 4);
  y += 15;
  doc
    .rect(20, y, 555, 80)
    .fillColor(lightBg)
    .strokeColor(primaryColor)
    .fillAndStroke();
  doc
    .fillColor("black")
    .fontSize(6)
    .text(
      "Si la presentación de esta declaración tiene por objeto incluir datos que, debiendo haber figurado en otra declaración del mismo ejercicio presentada anteriormente, hubieran sido completamente omitidos en la misma, o si el objeto es modificar parcialmente el contenido...",
      25,
      y + 5,
      { width: 540 }
    );

  doc
    .fontSize(7)
    .text("Declaración complementaria por inclusión de datos", 30, y + 35);
  drawXCheckBox(260, y + 33);
  doc.text(
    "Declaración complementaria por modificación o anulación de datos",
    30,
    y + 55
  );
  drawXCheckBox(260, y + 53);

  doc.text("Número identificativo de la declaración anterior", 280, y + 45);
  for (let i = 0; i < 13; i++) {
    doc
      .rect(445 + i * 9, y + 43, 9, 13)
      .fillColor("white")
      .strokeColor("black")
      .fillAndStroke();
  }
  doc.fillColor("black");

  // Resumen Section
  y += 95;
  doc.rect(20, y, 220, 15).fillColor(primaryColor).fill();
  doc
    .fillColor("white")
    .fontSize(9)
    .text("Resumen de los datos incluidos en la declaración", 25, y + 4);
  y += 15;
  doc
    .rect(20, y, 555, 85)
    .fillColor(lightBg)
    .strokeColor(primaryColor)
    .fillAndStroke();

  const rows = [
    {
      l: "Número total de personas y entidades",
      c: "01",
      v: summaryBoxes?.box01 ?? clients.length,
    },
    {
      l: "Importe total anual de las operaciones",
      c: "02",
      v: formatCurrency(
        summaryBoxes?.box02 ??
          clients.reduce((acc, c) => acc + c.totalAmount, 0)
      ),
    },
    { l: "Número total de inmuebles", c: "03", v: summaryBoxes?.box03 ?? "0" },
    {
      l: "Importe total de operaciones locales negocio",
      c: "04",
      v: summaryBoxes?.box04 ? formatCurrency(summaryBoxes.box04) : "0,00",
    },
  ];

  rows.forEach((r, i) => {
    const ry = y + 10 + i * 18;
    doc
      .fillColor("black")
      .fontSize(7)
      .text(
        r.l +
          " ....................................................................................................",
        25,
        ry
      );
    doc
      .rect(410, ry - 2, 20, 13)
      .fillColor(lightBg)
      .strokeColor("black")
      .fillAndStroke();
    doc.fillColor("black").text(r.c, 415, ry + 1);
    doc
      .rect(435, ry - 2, 130, 13)
      .fillColor("white")
      .strokeColor("black")
      .fillAndStroke();
    doc
      .fillColor("black")
      .text(r.v.toString(), 440, ry + 1, { width: 120, align: "right" });
  });
  // --- Section: Fecha y firma & Administración ---
  y += 100;

  // 1. Fecha y Firma (Left Box)
  const leftBoxW = 310;
  const boxH = 150;
  const gap = 15;

  // Tab Header Left
  doc
    .path(
      `M 20 ${y} L 85 ${y} Q 90 ${y} 90 ${y + 5} L 90 ${y + 15} L 20 ${
        y + 15
      } Z`
    )
    .fillColor(primaryColor)
    .fill();
  doc
    .fillColor("white")
    .fontSize(7)
    .text("Fecha y firma", 25, y + 4);

  // Main Box Left
  doc
    .rect(20, y + 15, leftBoxW, boxH)
    .fillColor(lightBg)
    .strokeColor(primaryColor)
    .fillAndStroke();

  // Date Row
  doc
    .fillColor("black")
    .fontSize(8)
    .text("Fecha:", 30, y + 35);
  doc
    .rect(65, y + 30, 200, 15)
    .fillColor("white")
    .strokeColor("#aaa")
    .fillAndStroke();
  doc
    .fillColor("black")
    .text(formatDate(new Date()), 70, y + 34, { width: 190, align: "right" });

  // Signature White Box
  const sigBoxX = 30;
  const sigBoxY = y + 55;
  const sigBoxW = leftBoxW - 20;
  const sigBoxH = 95;
  doc
    .rect(sigBoxX, sigBoxY, sigBoxW, sigBoxH)
    .fillColor("white")
    .strokeColor("#aaa")
    .fillAndStroke();

  doc
    .fillColor("black")
    .fontSize(7)
    .text("Firma:", sigBoxX + 5, sigBoxY + 5);

  // Fdo. and Cargo
  const lineStartY = sigBoxY + 75;
  const labelX = sigBoxX + 10;
  const lineW = sigBoxW - 20; // More padding from right
  const startLineX = labelX + 65; // Fixed start for both lines to align them
  const endLineX = labelX + lineW;

  doc.text("Fdo.: D/Dª.", labelX, lineStartY);
  doc
    .moveTo(startLineX, lineStartY + 7)
    .lineTo(endLineX, lineStartY + 7)
    .strokeColor("#333")
    .lineWidth(0.5)
    .stroke();

  // Declarer Name (Above the line)
  doc.fontSize(6).text(declarer.name, startLineX, lineStartY - 8, {
    width: endLineX - startLineX,
    align: "right",
  });

  doc.text("Cargo o empleo:", labelX, lineStartY + 10);
  doc
    .moveTo(startLineX, lineStartY + 17)
    .lineTo(endLineX, lineStartY + 17)
    .stroke();

  // 2. Administración (Right Box)
  const rightBoxX = 20 + leftBoxW + gap;
  const rightBoxW = 575 - rightBoxX;

  // Tab Header Right
  doc
    .path(
      `M ${rightBoxX} ${y} L ${rightBoxX + 160} ${y} Q ${
        rightBoxX + 165
      } ${y} ${rightBoxX + 165} ${y + 5} L ${rightBoxX + 165} ${
        y + 15
      } L ${rightBoxX} ${y + 15} Z`
    )
    .fillColor(primaryColor)
    .fill();
  doc
    .fillColor("white")
    .fontSize(7)
    .text("Espacio reservado para la Administración", rightBoxX + 5, y + 4);

  // Main Box Right
  doc
    .rect(rightBoxX, y + 15, rightBoxW, boxH)
    .fillColor(lightBg)
    .strokeColor(primaryColor)
    .fillAndStroke();

  // Inner White Box Right
  doc
    .rect(rightBoxX + 10, y + 25, rightBoxW - 20, boxH - 20)
    .fillColor("white")
    .strokeColor("#aaa")
    .fillAndStroke();

  y += 165;

  // --- Page 2: Relación de declarados ---
  const CHUNK_SIZE = 3;
  const clientChunks = [];
  for (let i = 0; i < clients.length; i += CHUNK_SIZE) {
    clientChunks.push(clients.slice(i, i + CHUNK_SIZE));
  }

  clientChunks.forEach((chunk, pageIdx) => {
    doc.addPage();
    drawModelHeader(pageIdx + 2, "Relación de declarados");
    y = 75;

    // Identification Sheet
    doc.rect(20, y, 220, 15).fillColor(primaryColor).fill();
    doc
      .fillColor("white")
      .fontSize(8)
      .text("Datos identificativos de esta hoja", 25, y + 4);
    doc
      .rect(20, y + 15, 220, 35)
      .lineWidth(1)
      .strokeColor(primaryColor)
      .stroke();
    doc
      .fillColor("black")
      .fontSize(7)
      .text("NIF del declarante", 25, y + 20);
    drawSimpleInput(25, y + 28, 80, 12, declarer.nif);
    doc.text("Ejercicio", 120, y + 20);
    drawSimpleInput(120, y + 28, 35, 12, year);
    doc.text("Hoja nº", 165, y + 20);
    drawSimpleInput(165, y + 28, 40, 12, pageIdx + 1);

    doc.save();
    doc.dash(4, { space: 2 });
    doc.rect(250, y, 325, 50).strokeColor("black").stroke();
    doc.restore();
    doc
      .fontSize(7)
      .text(
        "Espacio reservado para numeración por código de barras",
        350,
        y + 20
      );

    y += 65;

    // Always render exactly 3 declarado sections per page
    for (let ci = 0; ci < CHUNK_SIZE; ci++) {
      const client = chunk[ci] || {}; // Use empty object if no client data
      const hasData = chunk[ci] !== undefined;
      doc.rect(20, y, 90, 12).fillColor(primaryColor).fill();
      doc
        .fillColor("white")
        .fontSize(8)
        .text("Declarado " + (pageIdx * CHUNK_SIZE + ci + 1), 25, y + 2);
      doc
        .rect(20, y + 12, 555, 200)
        .fillColor(lightBg)
        .strokeColor(primaryColor)
        .fillAndStroke();

      let blockY = y + 18;

      // Row 1: NIF declarado, NIF A/A declarado, NIF representante, Apellidos y nombre
      drawFieldLabel("NIF declarado", 25, blockY, 5.5);
      drawSimpleInput(25, blockY + 7, 80, 13, hasData ? client.clientNIF : "");

      drawFieldLabel("NIF A/A declarado", 115, blockY, 5.5);
      drawSimpleInput(115, blockY + 7, 80, 13);

      drawFieldLabel("NIF representante", 205, blockY, 5.5);
      drawSimpleInput(205, blockY + 7, 80, 13);

      drawFieldLabel(
        "Apellidos y nombre, razón social o denominación del declarado",
        295,
        blockY,
        5.5
      );
      drawSimpleInput(
        295,
        blockY + 7,
        270,
        13,
        hasData ? client.clientName : ""
      );

      blockY += 26;

      // Row 2: Provincia, País, Clave operación, Checkboxes
      drawFieldLabel("Provincia (Código)", 25, blockY, 5.5);
      drawSimpleInput(
        25,
        blockY + 7,
        40,
        13,
        hasData && client.clientPostalCode
          ? client.clientPostalCode.substring(0, 2)
          : ""
      );

      drawFieldLabel("País (Código)", 75, blockY, 5.5);
      drawSimpleInput(75, blockY + 7, 40, 13, hasData ? "ES" : "");

      drawFieldLabel("Clave operación", 125, blockY, 5.5);
      drawSimpleInput(125, blockY + 7, 40, 13, hasData ? "B" : "");

      // Checkboxes
      const checks = [
        "Operación\nseguro",
        "Arrendamiento\nlocal negocio",
        "Operación\nIVA de caja",
        "Op. con inversión\nsujeto pasivo",
        "Op. régimen de depósito\ndistinto del aduanero",
      ];
      const checkX = [175, 245, 315, 385, 470];
      checks.forEach((c, idx) => {
        doc.fontSize(5).text(c, checkX[idx], blockY - 3, {
          width: 60,
          align: "center",
          lineGap: -1,
        });
        drawXCheckBox(
          checkX[idx] + 20,
          blockY + 8,
          hasData && c.includes("Arrendamiento") ? client.isRental : false
        );
      });

      blockY += 26;

      // Row 3: Importe percibido en metálico, Ejercicio
      drawFieldLabel("Importe percibido en metálico", 25, blockY, 5.5);
      drawSimpleInput(25, blockY + 7, 150, 13, "0,00", "right");

      drawFieldLabel("Ejercicio", 190, blockY, 5.5);
      const yr = year.toString();
      for (let i = 0; i < 4; i++) {
        doc
          .rect(190 + i * 12, blockY + 7, 11, 13)
          .strokeColor("black")
          .fillColor("white")
          .fillAndStroke();
        doc
          .fillColor("black")
          .fontSize(7)
          .text(yr[i], 193 + i * 12, blockY + 9);
      }

      blockY += 26;

      // Row 4: Importe anual de las operaciones
      drawFieldLabel("Importe anual de las operaciones", 25, blockY, 5.5);
      drawSimpleInput(
        25,
        blockY + 7,
        220,
        13,
        hasData ? formatCurrency(client.totalAmount) : "0,00",
        "right"
      );

      drawFieldLabel(
        "Importe anual percibido por transmisiones de inmuebles sujetas a IVA",
        255,
        blockY,
        5.5
      );
      drawSimpleInput(255, blockY + 7, 155, 13, "0,00", "right");

      drawFieldLabel(
        "Importe anual de las operaciones devengadas con criterio IVA de caja",
        420,
        blockY,
        5.5
      );
      drawSimpleInput(420, blockY + 7, 145, 13, "0,00", "right");

      blockY += 26;

      // Row 5: Importe de las operaciones (left) and Importe percibido por transmisiones (right) - SAME ROW
      drawFieldLabel("Importe de las operaciones", 25, blockY);
      drawFieldLabel(
        "Importe percibido por transmisiones de inmuebles sujetas a IVA",
        290,
        blockY
      );

      const qtrVals =
        hasData && client.q1 !== undefined
          ? [client.q1, client.q2, client.q3, client.q4]
          : [0, 0, 0, 0];

      // All 4 quarters displayed vertically in two columns
      for (let i = 0; i < 4; i++) {
        const rowY = blockY + 14 + i * 14;

        // Left column: Importe de las operaciones
        doc
          .fillColor("black")
          .fontSize(6)
          .text(i + 1 + "T", 25, rowY + 2);
        drawSimpleInput(
          40,
          rowY,
          110,
          11,
          formatCurrency(qtrVals[i]),
          "right",
          7
        );

        // Right column: Importe percibido por transmisiones
        doc
          .fillColor("black")
          .fontSize(6)
          .text(i + 1 + "T", 290, rowY + 2);
        drawSimpleInput(305, rowY, 110, 11, "0,00", "right", 7);
      }

      y += 205;
    }

    // Page Total
    const footerY = 750;
    doc.rect(20, footerY, 150, 15).fillColor(primaryColor).fill();
    doc
      .fillColor("white")
      .fontSize(8)
      .text("Total de la hoja", 25, footerY + 4);
    doc
      .rect(20, footerY + 15, 555, 30)
      .fillColor(lightBg)
      .strokeColor(primaryColor)
      .fillAndStroke();
    doc
      .fillColor("black")
      .fontSize(7)
      .text(
        "Suma de importes anuales de esta hoja ..............................................................",
        25,
        footerY + 25
      );
    const sumPage = chunk.reduce((acc, c) => acc + c.totalAmount, 0);
    drawSimpleInput(
      400,
      footerY + 22,
      165,
      15,
      formatCurrency(sumPage),
      "right",
      10
    );
  });

  // --- Page 3: Relación de inmuebles (Static) ---
  doc.addPage();
  drawModelHeader(3, "Relación de inmuebles");
  y = 75;
  doc.rect(20, y, 220, 15).fillColor(primaryColor).fill();
  doc
    .fillColor("white")
    .fontSize(8)
    .text("Datos identificativos de esta hoja", 25, y + 4);
  doc
    .rect(20, y + 15, 220, 35)
    .lineWidth(1)
    .strokeColor(primaryColor)
    .stroke();
  doc
    .fillColor("black")
    .fontSize(7)
    .text("NIF del declarante", 25, y + 20);
  drawSimpleInput(25, y + 28, 80, 12, declarer.nif);
  doc.text("Ejercicio", 120, y + 20);
  drawSimpleInput(120, y + 28, 35, 12, year);
  doc.text("Hoja nº 1 / 1", 165, y + 20);

  y += 65;
  for (let i = 0; i < 4; i++) {
    doc.rect(20, y, 90, 12).fillColor(primaryColor).fill();
    doc
      .fillColor("white")
      .fontSize(8)
      .text("Declarado " + (i + 1), 25, y + 2);
    doc
      .rect(20, y + 12, 555, 105)
      .fillColor(lightBg)
      .lineWidth(0.5)
      .strokeColor(primaryColor)
      .fillAndStroke();

    let by = y + 20;
    drawFieldLabel("NIF Arrendatario", 25, by);
    drawSimpleInput(25, by + 8, 80, 13);
    drawFieldLabel("Propiedad / Arrendatario", 110, by);
    drawSimpleInput(110, by + 8, 300, 13);

    by += 30;
    drawFieldLabel("Referencia Catastral", 25, by);
    drawSimpleInput(25, by + 8, 250, 13);
    drawFieldLabel("Importe", 285, by);
    drawSimpleInput(285, by + 8, 100, 13, "0,00", "right");

    by += 30;
    drawFieldLabel("Sit. inmueble (Código)", 25, by);
    drawSimpleInput(25, by + 8, 80, 13);
    drawFieldLabel("Dirección completa", 115, by);
    drawSimpleInput(115, by + 8, 450, 13);

    y += 125;
  }

  doc.end();
};

module.exports = {
  buildPDF,
  buildBudgetPDF,
  buildAlbaranPDF,
  buildModelo347PDF,
  sendPDFInvoiceByEmail,
};
