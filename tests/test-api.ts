import app from "../src/app.js";
import { prisma } from "../lib/prisma.js";
import type { Server } from "http";

let server: Server;
const PORT = 3099;
const BASE_URL = `http://localhost:${PORT}/api/invoices`;

async function runTests() {
  console.log("🚀 Starting API Integration Tests...\n");

  server = app.listen(PORT);

  try {
    // 1. Test POST /api/invoices (Create Draft)
    console.log("1️⃣ Testing Create Draft Invoice (POST /api/invoices)");
    const createRes = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Nguyen Van A",
        customerEmail: "a@example.com",
        items: [
          { description: "Macbook", quantity: 1, unitPrice: 2000 },
          { description: "Mouse", quantity: 2, unitPrice: 50 },
        ],
        taxRate: 10,
      }),
    });

    const createData = await createRes.json();
    console.log("Create response:", JSON.stringify(createData, null, 2));

    if (createRes.status !== 201) throw new Error(`Expected 201, got ${createRes.status}`);
    if (Number(createData.data.subtotal) !== 2100) throw new Error(`Expected subtotal 2100, got ${createData.data.subtotal}`);
    if (Number(createData.data.tax) !== 210) throw new Error(`Expected tax 210, got ${createData.data.tax}`);
    if (Number(createData.data.total) !== 2310) throw new Error(`Expected total 2310, got ${createData.data.total}`);
    if (createData.data.status !== "DRAFT") throw new Error(`Expected status DRAFT, got ${createData.data.status}`);
    const draftInvoiceId = createData.data.id;
    console.log("✅ Create draft invoice passed!\n");

    // 2. Test Zod Validation Error (Empty items / missing name)
    console.log("2️⃣ Testing Zod Validation Error (POST /api/invoices with invalid payload)");
    const invalidRes = await fetch(BASE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerEmail: "invalid-email",
        items: [],
      }),
    });
    const invalidData = await invalidRes.json();
    console.log("Validation error response:", JSON.stringify(invalidData, null, 2));
    if (invalidRes.status !== 422) throw new Error(`Expected 422, got ${invalidRes.status}`);
    if (invalidData.error?.code !== "VALIDATION_ERROR") throw new Error("Expected VALIDATION_ERROR");
    console.log("✅ Zod validation error handling passed!\n");

    // 3. Test GET /api/invoices and GET /api/invoices/:id
    console.log("3️⃣ Testing GET /api/invoices and GET /api/invoices/:id");
    const getListRes = await fetch(BASE_URL);
    const listData = await getListRes.json();
    if (getListRes.status !== 200 || !listData.data?.length) throw new Error("Failed to get invoices list");

    const getDetailRes = await fetch(`${BASE_URL}/${draftInvoiceId}`);
    const detailData = await getDetailRes.json();
    if (getDetailRes.status !== 200 || detailData.data?.id !== draftInvoiceId) throw new Error("Failed to get invoice detail");
    console.log("✅ GET invoices list and detail passed!\n");

    // 4. Test PATCH /api/invoices/:id (Update Draft)
    console.log("4️⃣ Testing PATCH /api/invoices/:id (Update Draft)");
    const patchRes = await fetch(`${BASE_URL}/${draftInvoiceId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: "Nguyen Van A Updated",
        items: [
          { description: "Macbook Pro", quantity: 1, unitPrice: 2500 },
        ],
        taxRate: 10,
      }),
    });
    const patchData = await patchRes.json();
    console.log("Patch response:", JSON.stringify(patchData, null, 2));
    if (Number(patchData.data.subtotal) !== 2500 || Number(patchData.data.total) !== 2750) {
      throw new Error(`Totals recalculation mismatch: ${patchData.data.total}`);
    }
    console.log("✅ PATCH draft invoice passed!\n");

    // 5. Test POST /api/invoices/:id/issue (Issue Invoice)
    console.log("5️⃣ Testing Issue Invoice (POST /api/invoices/:id/issue)");
    const issueRes = await fetch(`${BASE_URL}/${draftInvoiceId}/issue`, {
      method: "POST",
    });
    const issueData = await issueRes.json();
    console.log("Issue response:", JSON.stringify(issueData, null, 2));
    if (issueRes.status !== 200) throw new Error(`Expected 200, got ${issueRes.status}`);
    if (issueData.status !== "ISSUED" || !issueData.issuedAt) throw new Error("Expected status ISSUED and issuedAt");

    // Test Duplicate Issue (ISSUED -> ISSUED should fail)
    const duplicateIssueRes = await fetch(`${BASE_URL}/${draftInvoiceId}/issue`, {
      method: "POST",
    });
    const duplicateIssueData = await duplicateIssueRes.json();
    console.log("Duplicate issue response:", JSON.stringify(duplicateIssueData, null, 2));
    if (duplicateIssueRes.status !== 409) throw new Error(`Expected 409 Conflict, got ${duplicateIssueRes.status}`);
    console.log("✅ Issue invoice and duplicate prevention passed!\n");

    // 6. Test POST /api/invoices/:id/replace (Replace Invoice Transaction)
    console.log("6️⃣ Testing Replace Invoice Transaction (POST /api/invoices/:id/replace)");
    const replaceRes = await fetch(`${BASE_URL}/${draftInvoiceId}/replace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "Wrong customer address and item",
        customerName: "Nguyen Van B",
        customerEmail: "b@example.com",
        items: [
          { description: "Macbook Air", quantity: 1, unitPrice: 1500 },
        ],
        taxRate: 10,
      }),
    });
    const replaceData = await replaceRes.json();
    console.log("Replace response:", JSON.stringify(replaceData, null, 2));

    if (replaceRes.status !== 201) throw new Error(`Expected 201, got ${replaceRes.status}`);
    if (replaceData.data.status !== "DRAFT") throw new Error("Replacement invoice should start as DRAFT");
    if (replaceData.data.replacedInvoiceId !== draftInvoiceId) throw new Error("replacedInvoiceId must link to original invoice");

    // Check old invoice is now CANCELED
    const oldInvoiceRes = await fetch(`${BASE_URL}/${draftInvoiceId}`);
    const oldInvoiceData = await oldInvoiceRes.json();
    console.log("Original invoice after replace:", JSON.stringify(oldInvoiceData, null, 2));
    if (oldInvoiceData.data.status !== "CANCELED" || !oldInvoiceData.data.canceledAt) {
      throw new Error("Original invoice should be CANCELED after replace");
    }
    console.log("✅ Replace invoice with transaction passed!\n");

    // 7. Test Replace on DRAFT / CANCELED (Should fail)
    console.log("7️⃣ Testing Replace Invoice on non-ISSUED status (should fail)");
    const invalidReplaceRes = await fetch(`${BASE_URL}/${draftInvoiceId}/replace`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reason: "Another change",
        customerName: "Nguyen Van C",
        items: [{ description: "Item C", quantity: 1, unitPrice: 100 }],
      }),
    });
    const invalidReplaceData = await invalidReplaceRes.json();
    console.log("Invalid replace response:", JSON.stringify(invalidReplaceData, null, 2));
    if (invalidReplaceRes.status !== 400) throw new Error(`Expected 400, got ${invalidReplaceRes.status}`);
    console.log("✅ Replace rule validation passed!\n");

    // 8. Test Cancel Invoice
    console.log("8️⃣ Testing Cancel Invoice (POST /api/invoices/:id/cancel)");
    const newDraftId = replaceData.data.id;
    const cancelRes = await fetch(`${BASE_URL}/${newDraftId}/cancel`, {
      method: "POST",
    });
    const cancelData = await cancelRes.json();
    console.log("Cancel response:", JSON.stringify(cancelData, null, 2));
    if (cancelRes.status !== 200 || cancelData.data.status !== "CANCELED") {
      throw new Error("Failed to cancel invoice");
    }

    // Cancel already canceled invoice
    const reCancelRes = await fetch(`${BASE_URL}/${newDraftId}/cancel`, {
      method: "POST",
    });
    if (reCancelRes.status !== 400) throw new Error(`Expected 400 for re-canceling, got ${reCancelRes.status}`);
    console.log("✅ Cancel invoice passed!\n");

    // 9. Test PDF endpoint (Generate & Download PDF)
    console.log("9️⃣ Testing GET /api/invoices/:id/pdf (Generate & Download PDF)");
    const pdfRes = await fetch(`${BASE_URL}/${draftInvoiceId}/pdf`);
    const contentType = pdfRes.headers.get("content-type");
    const contentDisposition = pdfRes.headers.get("content-disposition");
    const pdfBuffer = Buffer.from(await pdfRes.arrayBuffer());

    console.log("PDF Content-Type:", contentType);
    console.log("PDF Content-Disposition:", contentDisposition);
    console.log("PDF Buffer size (bytes):", pdfBuffer.length);
    console.log("PDF Header signature:", pdfBuffer.subarray(0, 5).toString());

    if (pdfRes.status !== 200) throw new Error(`Expected 200 OK, got ${pdfRes.status}`);
    if (contentType !== "application/pdf") throw new Error(`Expected application/pdf, got ${contentType}`);
    if (!contentDisposition?.includes(".pdf")) throw new Error(`Expected attachment with .pdf filename, got ${contentDisposition}`);
    if (pdfBuffer.subarray(0, 4).toString() !== "%PDF") throw new Error("Generated file is not a valid PDF");
    console.log("✅ PDF generation & download passed!\n");


    console.log("🎉 ALL INTEGRATION TESTS PASSED PERFECTLY! 🎉");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exitCode = 1;
  } finally {
    server?.close();
    await prisma.$disconnect();
  }
}

runTests();
