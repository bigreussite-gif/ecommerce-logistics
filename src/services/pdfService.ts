import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Commande, LigneCommande } from '../types';

/**
 * Standardized Price Formatter for PDFs
 * Uses '.' as thousands separator and ensures bold formatting.
 */
const fP = (num: number) => {
  if (num === undefined || num === null) return "0";
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
};

// Extend jsPDF type to include autotable
interface jsPDFWithPlugin extends jsPDF {
  autoTable: (options: any) => jsPDF;
}

export const generateInvoicePDF = (commande: Commande & { lignes: LigneCommande[] }) => {
  const doc = new jsPDF() as jsPDFWithPlugin;
  const pageWidth = doc.internal.pageSize.width;
  
  // --- HEADER & BRANDING ---
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(99, 102, 255); // GomboSwift Primary
  doc.text("GomboSwift", 20, 25);
  
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.text("Solution de Logistique E-commerce", 20, 32);
  doc.text("Contact: +225 01-72-57-13-52", 20, 37);
  doc.text("Abidjan, Côte d'Ivoire", 20, 42);

  // Invoice Title & Info
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text("FACTURE", pageWidth - 20, 25, { align: 'right' });
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.text(`N°: #${(commande.id || "0000").substring(0, 8).toUpperCase()}`, pageWidth - 20, 32, { align: 'right' });
  doc.text(`Date: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`, pageWidth - 20, 37, { align: 'right' });

  // --- CLIENT INFO ---
  doc.setDrawColor(241, 245, 249);
  doc.line(20, 55, pageWidth - 20, 55);
  
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text("DESTINATAIRE :", 20, 65);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(commande.nom_client || "Client Divers", 20, 72);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(`Tel: ${commande.telephone_client || 'Non renseigné'}`, 20, 78);
  doc.text(`Zone: ${commande.commune_livraison}`, 20, 83);
  doc.text(`Adresse: ${commande.adresse_livraison}`, 20, 88);

  // --- TABLE OF PRODUCTS ---
  const tableRows = (commande.lignes || []).map((l, index) => [
    index + 1,
    l.nom_produit,
    l.quantite,
    `${fP(l.prix_unitaire || 0)} CFA`,
    `${fP(l.montant_ligne || 0)} CFA`
  ]);

  autoTable(doc, {
    startY: 100,
    head: [['#', 'Désignation', 'Qté', 'Prix Unitaire', 'Total']],
    body: tableRows,
    theme: 'grid',
    headStyles: {
      fillColor: [99, 102, 255],
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'center'
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 10 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'right', cellWidth: 35, fontStyle: 'bold' },
      4: { halign: 'right', cellWidth: 35, fontStyle: 'bold' }
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      valign: 'middle'
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    }
  });

  // --- TOTALS ---
  const finalY = (doc as any).lastAutoTable?.finalY || 150;
  const subtotal = (commande.lignes || []).reduce((acc, l) => acc + (l.montant_ligne || 0), 0);
  const delivery = commande.frais_livraison || 0;
  const total = subtotal + delivery;

  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.setFont("helvetica", "normal");
  doc.text("Sous-total :", pageWidth - 80, finalY + 10);
  doc.setFont("helvetica", "bold");
  doc.text(`${fP(subtotal)} CFA`, pageWidth - 20, finalY + 10, { align: 'right' });

  doc.setFont("helvetica", "normal");
  doc.text("Frais de livraison :", pageWidth - 80, finalY + 17);
  doc.setFont("helvetica", "bold");
  doc.text(`${fP(delivery)} CFA`, pageWidth - 20, finalY + 17, { align: 'right' });

  doc.setDrawColor(99, 102, 255);
  doc.setLineWidth(0.5);
  doc.line(pageWidth - 85, finalY + 22, pageWidth - 20, finalY + 22);

  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL À PAYER :", pageWidth - 85, finalY + 32);
  doc.text(`${fP(total)} CFA`, pageWidth - 20, finalY + 32, { align: 'right' });

  // --- FOOTER ---
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "italic");
  const footerText = "Merci d'avoir choisi GomboSwift pour votre livraison !";
  doc.text(footerText, pageWidth / 2, 280, { align: 'center' });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("GomboSwift S.A.S - RCCM: CI-ABJ-03-2024-B-00000", pageWidth / 2, 285, { align: 'center' });

  // Save the PDF
  doc.save(`Facture_GomboSwift_${(commande.id || "0000").substring(0, 8).toUpperCase()}.pdf`);
};

export const generateDeliverySlipPDF = (feuilleRoute: any, commandes: Commande[]) => {
  if (!feuilleRoute || !feuilleRoute.id) {
    console.error("Impossible de générer le PDF : ID de feuille de route manquant.");
    return;
  }

  const doc = new jsPDF('l', 'mm', 'a4') as jsPDFWithPlugin;
  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const lightGrey: [number, number, number] = [226, 232, 240]; 
  const darkText: [number, number, number] = [30, 41, 59];
  
  // Title - Small and top with branding
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184);
  doc.text("LOGICIEL GOMBOSWIFT - GESTION LOGISTIQUE", 15, 10);
  
  doc.setFontSize(14);
  doc.setTextColor(darkText[0], darkText[1], darkText[2]);
  const displayDate = feuilleRoute.date ? new Date(feuilleRoute.date) : new Date();
  doc.text(`Feuille de route de Livraison - ${format(displayDate, 'yyyy-MM-dd')}`, pageWidth - 15, 10, { align: 'right' });

  // --- TABLEAU RÉSUMÉ 1: INFOS LIVREUR ---
  const totalObjectif = (commandes || []).reduce((acc, c) => acc + (Number(c.montant_total) || 0), 0);
  
  autoTable(doc, {
    startY: 15,
    margin: { left: 15, right: 15 },
    head: [['Nom & Prénoms du Livreur', 'Téléphone', 'Nombre de colis', 'Somme Totale à Encaisser']],
    body: [[
      (feuilleRoute.nom_livreur || "Personnel GomboSwift").toUpperCase(),
      "-", 
      commandes.length.toString(),
      `${fP(totalObjectif)}`
    ]],
    theme: 'grid',
    headStyles: { fillColor: lightGrey, textColor: darkText, fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 2, textColor: darkText },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 50 },
      2: { cellWidth: 40 },
      3: { cellWidth: 'auto', fontStyle: 'bold', fontSize: 12 } // Grand prix et Gras
    }
  });

  // --- TABLEAU RÉSUMÉ 2: RÉCONCILIATION ---
  const lastY1 = (doc as any).lastAutoTable.finalY + 5;
  autoTable(doc, {
    startY: lastY1,
    margin: { left: 15, right: 15 },
    head: [['Colis Retournés', 'Colis Livrés', 'Somme à verser à la caisse', 'Reste à percevoir']],
    body: [[' ', ' ', ' ', ' ']], 
    theme: 'grid',
    headStyles: { fillColor: lightGrey, textColor: darkText, fontSize: 9, fontStyle: 'bold' },
    styles: { fontSize: 10, cellPadding: 2, textColor: darkText },
    columnStyles: {
      0: { cellWidth: 85 },
      1: { cellWidth: 65 },
      2: { cellWidth: 85 },
      3: { cellWidth: 'auto' }
    }
  });

  // --- TABLEAU PRINCIPAL: DÉTAILS COMMANDES ---
  const lastY2 = (doc as any).lastAutoTable.finalY + 8;
  const tableRows = (commandes || []).map((c) => {
    const itemsStr = (c.lignes || []).map((l: LigneCommande) => 
      `${l.nom_produit} (x${l.quantite})`
    ).join('\n');
    
    const puStr = (c.lignes || []).map((l: LigneCommande) => 
       `${fP(l.prix_unitaire || 0)}`
    ).join('\n');

    const qtyStr = (c.lignes || []).map((l: LigneCommande) => 
       `${l.quantite}`
    ).join('\n');
    
    return [
      `#${(c.id || "").substring(0, 8).toUpperCase()}`,
      itemsStr || "SANS ARTICLES",
      " ", 
      c.nom_client || "Client",
      puStr || "0",
      `${fP(c.frais_livraison || 0)}`,
      qtyStr || "0",
      `${fP(c.montant_total || 0)}`,
      c.telephone_client || "-",
      `${c.commune_livraison || ""} - ${c.adresse_livraison || ""}`.trim() || "-",
      " " 
    ];
  });

  autoTable(doc, {
    startY: lastY2,
    margin: { left: 15, right: 15 },
    head: [[
      'N°', 
      'Articles commandés', 
      'Taille', 
      'Client', 
      'P.U.', 
      'Frais', 
      'Qté', 
      'Net à payer', 
      'Téléphone', 
      'Zone / Lieu', 
      'Observation'
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: lightGrey, textColor: darkText, fontSize: 8, fontStyle: 'bold' },
    styles: { fontSize: 8, cellPadding: 2, textColor: darkText },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 60 },
      2: { cellWidth: 15 },
      3: { cellWidth: 25 },
      4: { cellWidth: 20, fontStyle: 'bold' }, // PU Gras
      5: { cellWidth: 20, fontStyle: 'bold' }, // Frais Gras
      6: { cellWidth: 10 },
      7: { cellWidth: 25, fontStyle: 'bold', fontSize: 10 }, // Net Gras
      8: { cellWidth: 30 },
      9: { cellWidth: 25 },
      10: { cellWidth: 'auto' }
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY;
  
  // Footer with specific requested info
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  const footerY = pageHeight - 15;
  
  doc.text("Signature Livreur (précédé de 'Reçu')", 15, finalY + 12);
  doc.text("Cachet & Signature Logistique", pageWidth - 15, finalY + 12, { align: 'right' });

  doc.setDrawColor(226, 232, 240);
  doc.line(15, footerY - 2, pageWidth - 15, footerY - 2);
  
  doc.setFont("helvetica", "bold");
  doc.setTextColor(51, 65, 85);
  doc.text("SUPPORT CLIENT & CALL CENTER : +225 01 72 57 13 52", pageWidth / 2, footerY + 2, { align: 'center' });
  doc.setFont("helvetica", "normal");
  doc.text("Adresse : Yop Toit rouge, Non loin de la grande Mosquée, stade BAE", pageWidth / 2, footerY + 7, { align: 'center' });

  doc.save(`FeuilleRoute_GomboSwift_${format(displayDate, 'dd_MM_yyyy')}.pdf`);
};

export const generateAnalyticalReportPDF = (data: any, dateString: string) => {
  try {
    const doc = new jsPDF() as jsPDFWithPlugin;
    const pageWidth = doc.internal.pageSize.width;

    if (!data || !data.commandes) {
      throw new Error("Données de rapport incomplètes");
    }

    // Header Branding
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(99, 102, 255);
    doc.text("GomboSwift Analysis", 20, 25);
    
    doc.setFontSize(12);
    doc.setTextColor(100, 116, 139);
    doc.setFont("helvetica", "normal");
    
    const formattedDate = dateString ? format(new Date(dateString), 'dd MMMM yyyy', { locale: fr }) : "Date inconnue";
    doc.text(`Rapport Analytique Business du ${formattedDate}`, 20, 32);

    // Financial Summary
    const getFrais = (c: any) => {
      if (c.frais_livraison !== undefined && c.frais_livraison !== null) return Number(c.frais_livraison);
      if (['terminee', 'livree'].includes(c.statut_commande)) return 1000;
      return 0;
    };

    const succesCmds = (data.commandes || []).filter((c: any) => c.statut_commande === 'terminee' || c.statut_commande === 'livree');
    const totalEncaisseBrut = (data.retours || []).reduce((acc: number, r: any) => acc + (r.montant_remis_par_livreur || 0), 0);
    const totalFraisLivraison = succesCmds.reduce((acc: number, c: any) => acc + getFrais(c), 0);
    const totalNetProduits = totalEncaisseBrut - totalFraisLivraison;
    
    const countTotal = (data.commandes || []).length;
    const successRate = countTotal > 0 ? (succesCmds.length / countTotal) * 100 : 0;

    doc.setDrawColor(241, 245, 249);
    doc.setFillColor(248, 250, 252);
    doc.rect(20, 45, pageWidth - 40, 40, 'F');
    
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text("RÉSUMÉ FINANCIER (CFA)", 25, 53);
    
    doc.setFontSize(14);
    doc.setTextColor(30, 41, 59);
    doc.setFont("helvetica", "bold");
    doc.text(`CA Produits Net: ${fP(totalNetProduits)}`, 25, 63);
    doc.text(`Logistique: ${fP(totalFraisLivraison)}`, 25, 73);
    doc.text(`Total Encaissé: ${fP(totalEncaisseBrut)}`, pageWidth - 25, 63, { align: 'right' });
    doc.text(`Taux de Succès: ${successRate.toFixed(1)}%`, pageWidth - 25, 73, { align: 'right' });

    // Detailed Table
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Détails des Opérations de Caisse", 20, 100);

    const tableRows = (data.retours || []).map((r: any) => {
      const frId = String(r.feuille_route_id || "");
      return [
        frId ? `#${frId.substring(0, 8).toUpperCase()}` : "N/A",
        fP(r.montant_remis_par_livreur || 0),
        fP(r.montant_attendu || 0),
        fP(r.ecart || 0),
        r.commentaire || "-"
      ];
    });

    autoTable(doc, {
      startY: 105,
      head: [['Bordereau', 'Reçu (Cash)', 'Théorique', 'Écart', 'Observations']],
      body: tableRows,
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 255] },
      columnStyles: {
        1: { halign: 'right', fontStyle: 'bold' },
        2: { halign: 'right', fontStyle: 'bold' },
        3: { halign: 'right', fontStyle: 'bold' }
      }
    });

    // Save
    doc.save(`Rapport_Analytique_${dateString || 'journee'}_GomboSwift.pdf`);
  } catch (err) {
    console.error("Critical error inside generateAnalyticalReportPDF:", err);
    throw err;
  }
};

export const generateAuditReportPDF = (
  metrics: any, 
  transactions: any[], 
  dateRange: { start: string, end: string }
) => {
  const doc = new jsPDF() as jsPDFWithPlugin;
  const pageWidth = doc.internal.pageSize.width;

  // --- 1. HEADER & BRANDING ---
  doc.setFillColor(30, 41, 59); // Dark Slate
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text("GomboSwift Finance", 20, 25);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("RAPPORT D'AUDIT ET D'EXPERTISE COMPTABLE", pageWidth - 20, 25, { align: 'right' });
  
  // --- 2. PERIOD INFO ---
  doc.setTextColor(30, 41, 59);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(`Synthèse Financière Périodique`, 20, 55);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Période du ${dateRange.start} au ${dateRange.end}`, 20, 62);

  // --- 3. METRICS GRID ---
  autoTable(doc, {
    startY: 70,
    head: [['Indicateur de Performance', 'Valeur (CFA)', 'Observation']],
    body: [
      ['Chiffre d\'Affaires Brut', fP(metrics.ca_brut), 'Total des ventes enregistrées'],
      ['Coût des Marchandises (COGS)', fP(metrics.cogs_total), 'Prix d\'achat des produits vendus'],
      ['Marge Brute d\'Exploitation', fP(metrics.ca_brut - metrics.cogs_total), `${metrics.marge_brute_percent}% du CA`],
      ['Charges Fixes & Dépenses', fP(metrics.depenses_fixes_total), 'Logistique et frais administratifs'],
      ['BÉNÉFICE NET (EBITDA)', fP(metrics.profit_net), `Marge nette: ${metrics.marge_nette_percent}%`]
    ],
    theme: 'grid',
    headStyles: { fillColor: [71, 85, 105], fontSize: 10 },
    styles: { cellPadding: 5 },
    columnStyles: {
      1: { halign: 'right', fontStyle: 'bold', fontSize: 11 } // Valeurs en gras
    }
  });

  // --- 4. TRANSACTION RESUME ---
  const finalY1 = (doc as any).lastAutoTable.finalY + 15;
  doc.setFont("helvetica", "bold");
  doc.text("Journal des Opérations Majeures", 20, finalY1);

  const tableRows = transactions.slice(0, 30).map(t => [
    format(new Date(t.date), 'dd/MM/yyyy'),
    t.description.substring(0, 45),
    t.categorie,
    fP(t.montant)
  ]);

  autoTable(doc, {
    startY: finalY1 + 5,
    head: [['Date', 'Description', 'Catégorie', 'Montant']],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 255] },
    columnStyles: {
      3: { halign: 'right', fontStyle: 'bold' } // Montant en gras
    }
  });

  // --- FOOTER ---
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.setFont("helvetica", "normal");
  doc.text("Ce document est certifié conforme aux écritures comptables enregistrées dans le système GomboSwift.", pageWidth / 2, 285, { align: 'center' });

  doc.save(`Bilan_Expertise_${dateRange.start}_${dateRange.end}.pdf`);
};
