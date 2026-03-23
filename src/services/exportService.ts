import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

/**
 * Generates a professional CSV file that Excel can open perfectly.
 * Includes detailed headers and financial data.
 */
export const exportToExcel = (data: any[], filename: string) => {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(","),
    ...data.map(row => 
      headers.map(header => {
        const val = row[header];
        // Escape commas and wrap in quotes if needed
        return typeof val === 'string' && val.includes(',') ? `"${val}"` : val;
      }).join(",")
    )
  ].join("\n");

  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Generates a Word-compatible .doc file using HTML conversion.
 * Format specifically for banks/accountants.
 */
export const exportToWord = (content: { 
  title: string, 
  period: string, 
  metrics: { label: string, value: string }[],
  summary: string 
}, filename: string) => {
  const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>${content.title}</title>
    <style>
      body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; }
      .header { text-align: center; border-bottom: 2px solid #2c3e50; margin-bottom: 20px; padding-bottom: 10px; }
      .title { font-size: 18pt; font-weight: bold; color: #2c3e50; }
      .period { font-size: 10pt; color: #7f8c8d; }
      .section-title { font-size: 14pt; font-weight: bold; margin-top: 20px; color: #2980b9; border-bottom: 1px solid #bdc3c7; }
      .metric-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
      .metric-table td { padding: 8px; border: 1px solid #ecf0f1; }
      .label { font-weight: bold; width: 60%; background-color: #f9f9f9; }
      .value { text-align: right; font-weight: bold; color: #27ae60; }
      .footer { margin-top: 50px; font-size: 9pt; color: #95a5a6; border-top: 1px solid #bdc3c7; padding-top: 10px; }
      .signature-block { margin-top: 40px; }
      .signature-box { width: 250px; height: 80px; border: 1px dashed #bdc3c7; margin-top: 10px; }
    </style>
    </head>
    <body>
      <div class="header">
        <div class="title">BILAN DE TRÉSORERIE PROFESSIONNEL</div>
        <div class="period">GomboSwift Application Logiciel - Période: ${content.period}</div>
      </div>
      
      <div class="section-title">RÉSUMÉ ANALYTIQUE</div>
      <table class="metric-table">
        ${content.metrics.map(m => `
          <tr>
            <td class="label">${m.label}</td>
            <td class="value">${m.value}</td>
          </tr>
        `).join('')}
      </table>
      
      <div class="section-title">CONSIDÉRATIONS DE L'EXPERT</div>
      <p style="margin-top: 10px; line-height: 1.5;">${content.summary}</p>
      
      <div class="signature-block">
        <table style="width: 100%;">
          <tr>
            <td>
              <strong>Le Comptable / Auditeur</strong><br/>
              (Signature et Cachet)
              <div class="signature-box"></div>
            </td>
            <td style="text-align: right;">
              <strong>La Direction Générale</strong><br/>
              (Signature et Cachet)
              <div class="signature-box" style="margin-left: auto;"></div>
            </td>
          </tr>
        </table>
      </div>
      
      <div class="footer">
        Document généré automatiquement le ${format(new Date(), 'dd MMMM yyyy HH:mm', { locale: fr })}<br/>
        Logiciel de Gestion GomboSwift - Identifiant Audit: ${Math.random().toString(36).substring(2, 10).toUpperCase()}
      </div>
    </body>
    </html>
  `;

  const blob = new Blob([html], { type: 'application/msword' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${format(new Date(), 'yyyy-MM-dd')}.doc`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
