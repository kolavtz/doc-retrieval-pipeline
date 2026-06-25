import { DocumentData } from '../store/usePlatformStore';

// Dynamic script loader for XLSX to ensure SSR compatibility
const loadXlsx = async (): Promise<any> => {
  return import('xlsx');
};

const parseMonthYear = (dateStr: string): string => {
  if (!dateStr) return 'Unsorted';
  
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      const months = [
        'January', 'February', 'March', 'April', 'May', 'June', 
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      return `${months[d.getMonth()]} ${d.getFullYear()}`;
    }
  } catch {}
  
  // Custom fallback parser for text-based dates
  const lower = dateStr.toLowerCase();
  const monthsList = [
    'january', 'february', 'march', 'april', 'may', 'june', 
    'july', 'august', 'september', 'october', 'november', 'december'
  ];
  const monthShorts = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  
  let foundMonth = -1;
  for (let m = 0; m < 12; m++) {
    if (lower.includes(monthsList[m]) || lower.includes(monthShorts[m])) {
      foundMonth = m;
      break;
    }
  }

  const yearMatch = dateStr.match(/\b(20\d{2})\b/);
  const year = yearMatch ? yearMatch[1] : new Date().getFullYear().toString();

  if (foundMonth !== -1) {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June', 
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return `${months[foundMonth]} ${year}`;
  }

  return 'Unsorted';
};

export async function exportBillingToExcel(documents: DocumentData[]) {
  try {
    const XLSX = await loadXlsx();

    // 1. Filter out documents with billing data
    const billingDocs = documents.filter((doc) => {
      if (doc.status !== 'completed' || !doc.extractionResult) return false;
      const data = doc.extractionResult.extractedData;
      return (
        data.grand_total !== undefined || 
        data.invoice_number !== undefined || 
        data.invoice_date !== undefined
      );
    });

    if (billingDocs.length === 0) {
      alert("No completed billing documents found. Please ingest and extract bills first.");
      return;
    }

    // 2. Group bills by Month
    const billsByMonth: Record<string, any[]> = {};

    billingDocs.forEach((doc) => {
      const data = doc.extractionResult!.extractedData;
      const dateStr = data.invoice_date || data.statement_date || data.report_date || '';
      const monthYear = parseMonthYear(dateStr);
      
      const parsedAmount = typeof data.grand_total === 'number' 
        ? data.grand_total 
        : parseFloat(String(data.grand_total || '0').replace(/[^0-9.]/g, ''));

      const parsedSubtotal = typeof data.subtotal === 'number'
        ? data.subtotal
        : parseFloat(String(data.subtotal || '0').replace(/[^0-9.]/g, ''));

      const parsedTax = typeof data.tax === 'number'
        ? data.tax
        : parseFloat(String(data.tax || '0').replace(/[^0-9.]/g, ''));

      const billRecord = {
        id: doc.id,
        fileName: doc.name,
        date: dateStr,
        sortDate: new Date(dateStr).getTime() || 0,
        invoiceNumber: data.invoice_number || 'N/A',
        vendor: data.vendor_name || 'Unknown Vendor',
        client: data.client_name || 'Jane Doe',
        subtotal: isNaN(parsedSubtotal) ? 0 : parsedSubtotal,
        tax: isNaN(parsedTax) ? 0 : parsedTax,
        total: isNaN(parsedAmount) ? 0 : parsedAmount,
        currency: data.currency || 'USD',
        terms: data.payment_terms || 'Net 30'
      };

      if (!billsByMonth[monthYear]) {
        billsByMonth[monthYear] = [];
      }
      billsByMonth[monthYear].push(billRecord);
    });

    // 3. Create Workbook
    const wb = XLSX.utils.book_new();

    // 4. Sort months chronologically or alphabetically
    const months = Object.keys(billsByMonth).sort((a, b) => {
      if (a === 'Unsorted') return 1;
      if (b === 'Unsorted') return -1;
      return new Date(a).getTime() - new Date(b).getTime();
    });

    months.forEach((monthName) => {
      // Sort bills in this month by date
      const sortedBills = billsByMonth[monthName].sort((a, b) => a.sortDate - b.sortDate);

      // Create spreadsheet rows
      const sheetRows = sortedBills.map((b) => ({
        'Bill Date': b.date || 'N/A',
        'Invoice ID': b.invoiceNumber,
        'Vendor Name': b.vendor,
        'Client Name': b.client,
        'Subtotal': b.subtotal,
        'Tax Amount': b.tax,
        'Grand Total': b.total,
        'Currency': b.currency,
        'Payment Terms': b.terms
      }));

      // Calculate totals
      const subtotalSum = sortedBills.reduce((sum, b) => sum + b.subtotal, 0);
      const taxSum = sortedBills.reduce((sum, b) => sum + b.tax, 0);
      const totalSum = sortedBills.reduce((sum, b) => sum + b.total, 0);
      const currencyCode = sortedBills[0]?.currency || 'USD';

      // Append spacer and totals summary row
      sheetRows.push({
        'Bill Date': '',
        'Invoice ID': '',
        'Vendor Name': '',
        'Client Name': '',
        'Subtotal': 0,
        'Tax Amount': 0,
        'Grand Total': 0,
        'Currency': '',
        'Payment Terms': ''
      }); // Spacer

      sheetRows.push({
        'Bill Date': 'MONTH ACCUMULATED SPEND',
        'Invoice ID': '',
        'Vendor Name': '',
        'Client Name': '',
        'Subtotal': subtotalSum,
        'Tax Amount': taxSum,
        'Grand Total': totalSum,
        'Currency': currencyCode,
        'Payment Terms': ''
      });

      // Convert JSON array to Worksheet
      const ws = XLSX.utils.json_to_sheet(sheetRows);

      // Format column widths for readability
      const colWidths = [
        { wch: 18 }, // Bill Date
        { wch: 14 }, // Invoice ID
        { wch: 26 }, // Vendor Name
        { wch: 22 }, // Client Name
        { wch: 12 }, // Subtotal
        { wch: 12 }, // Tax Amount
        { wch: 14 }, // Grand Total
        { wch: 10 }, // Currency
        { wch: 14 }  // Payment Terms
      ];
      ws['!cols'] = colWidths;

      // Append sheet to workbook
      // Limit monthName to 30 characters (Excel sheet limit is 31)
      const cleanSheetName = monthName.substring(0, 30);
      XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);
    });

    // 5. Trigger download file
    XLSX.writeFile(wb, `AetherDoc_Consolidated_Billing_${new Date().getFullYear()}.xlsx`);

  } catch (error) {
    console.error('Error generating Excel file:', error);
    alert('Failed to generate Excel file. Check console logs.');
  }
}
