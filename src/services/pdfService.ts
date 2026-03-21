import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Commande, LigneCommande } from '../types';

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
  doc.text("Contact: +225 00 00 00 00", 20, 37);
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
    `${(l.prix_unitaire || 0).toLocaleString()} CFA`,
    `${(l.montant_ligne || 0).toLocaleString()} CFA`
  ]);

  doc.autoTable({
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
      3: { halign: 'right', cellWidth: 35 },
      4: { halign: 'right', cellWidth: 35 }
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
  doc.text("Sous-total :", pageWidth - 80, finalY + 10);
  doc.text(`${subtotal.toLocaleString()} CFA`, pageWidth - 20, finalY + 10, { align: 'right' });

  doc.text("Frais de livraison :", pageWidth - 80, finalY + 17);
  doc.text(`${delivery.toLocaleString()} CFA`, pageWidth - 20, finalY + 17, { align: 'right' });

  doc.setDrawColor(99, 102, 255);
  doc.setLineWidth(0.5);
  doc.line(pageWidth - 85, finalY + 22, pageWidth - 20, finalY + 22);

  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text("TOTAL À PAYER :", pageWidth - 85, finalY + 32);
  doc.text(`${total.toLocaleString()} CFA`, pageWidth - 20, finalY + 32, { align: 'right' });

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

  const doc = new jsPDF() as jsPDFWithPlugin;
  const pageWidth = doc.internal.pageSize.width;

  // Header
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.setTextColor(99, 102, 255);
  doc.text("GomboSwift Logistique", 20, 25);
  
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text("FEUILLE DE ROUTE LIVREUR", pageWidth - 20, 25, { align: 'right' });

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.text(`Réf: #${(feuilleRoute.id || "0000").substring(0, 8).toUpperCase()}`, pageWidth - 20, 32, { align: 'right' });
  doc.text(`Date: ${format(new Date(), 'dd MMMM yyyy', { locale: fr })}`, pageWidth - 20, 37, { align: 'right' });

  // Livreur Info
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text("LIVREUR ASSIGNÉ :", 20, 50);
  doc.setFontSize(14);
  doc.text(feuilleRoute.nom_livreur || "Personnel GomboSwift", 20, 60);

  // Commandes Table
  const tableRows = (commandes || []).map((c, i) => {
    // Try to get total quantity if available, otherwise 1
    const totalQty = c.nombre_produits || 1;
    // P.U. Moyen or Main product price
    const pu = (Number(c.montant_total) - (Number(c.frais_livraison) || 0)) / totalQty;
    
    return [
      i + 1,
      `#${(c.id || "").substring(0, 8).toUpperCase()}`,
      c.nom_client || "Client",
      c.commune_livraison || "-",
      `${totalQty} pc`,
      `${pu.toLocaleString()} CFA`,
      `${(c.montant_total || 0).toLocaleString()} CFA`
    ];
  });

  doc.autoTable({
    startY: 75,
    head: [['N°', 'Réf Cmd', 'Client', 'Zone', 'Qté', 'P.U.', 'À Encaisser']],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 8 },
      1: { cellWidth: 22 },
      2: { cellWidth: 'auto' },
      3: { cellWidth: 25 },
      4: { halign: 'center', cellWidth: 15 },
      5: { halign: 'right', cellWidth: 25 },
      6: { halign: 'right', cellWidth: 30 }
    },
    styles: { fontSize: 8 }
  });

  const finalY = (doc as any).lastAutoTable?.finalY || 100;
  doc.setFontSize(10);
  doc.setTextColor(30, 41, 59);
  doc.setDrawColor(200);
  doc.line(20, finalY + 20, 80, finalY + 20);
  doc.text("Signature Livreur", 20, finalY + 25);

  doc.line(pageWidth - 80, finalY + 20, pageWidth - 20, finalY + 20);
  doc.text("Cachet Logistique", pageWidth - 80, finalY + 25);

  doc.save(`FeuilleRoute_GomboSwift_${(feuilleRoute.id || "0000").substring(0, 8).toUpperCase()}.pdf`);
};

export const generateAnalyticalReportPDF = (data: any, dateString: string) => {
  const doc = new jsPDF() as jsPDFWithPlugin;
  const pageWidth = doc.internal.pageSize.width;

  // Header Branding
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(99, 102, 255);
  doc.text("GomboSwift Analysis", 20, 25);
  
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139);
  doc.setFont("helvetica", "normal");
  doc.text(`Rapport Analytique Business du ${format(new Date(dateString), 'dd MMMM yyyy', { locale: fr })}`, 20, 32);

  // Financial Summary
  const succesCmds = data.commandes.filter((c: any) => c.statut_commande === 'terminee' || c.statut_commande === 'livree');
  const failureCmds = data.commandes.filter((c: any) => !['terminee', 'livree', 'en_cours_livraison'].includes(c.statut_commande));
  
  const totalEncaisseBrut = data.retours.reduce((acc: number, r: any) => acc + (r.montant_remis_par_livreur || 0), 0);
  const totalFraisLivraison = succesCmds.reduce((acc: number, c: any) => acc + (c.frais_livraison || 0), 0);
  const totalNetProduits = totalEncaisseBrut - totalFraisLivraison;
  
  const successRate = data.commandes.length > 0 ? (succesCmds.length / data.commandes.length) * 100 : 0;

  doc.setDrawColor(241, 245, 249);
  doc.setFillColor(248, 250, 252);
  doc.rect(20, 45, pageWidth - 40, 40, 'F');
  
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("RÉSUMÉ FINANCIER (CFA)", 25, 53);
  
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "bold");
  doc.text(`CA Produits Net: ${totalNetProduits.toLocaleString()}`, 25, 63);
  doc.text(`Logistique: ${totalFraisLivraison.toLocaleString()}`, 25, 73);
  doc.text(`Total Encaissé: ${totalEncaisseBrut.toLocaleString()}`, pageWidth - 25, 63, { align: 'right' });
  doc.text(`Taux de Succès: ${successRate.toFixed(1)}%`, pageWidth - 25, 73, { align: 'right' });

  // Detailed Table
  doc.setFontSize(14);
  doc.text("Détails des Opérations de Caisse", 20, 100);

  const tableRows = (data.retours || []).map((r: any) => [
    `#${r.feuille_route_id.substring(0, 8).toUpperCase()}`,
    r.montant_remis_par_livreur?.toLocaleString(),
    r.montant_attendu?.toLocaleString(),
    r.ecart?.toLocaleString(),
    r.commentaire || "-"
  ]);

  doc.autoTable({
    startY: 105,
    head: [['Bordereau', 'Reçu (Cash)', 'Théorique', 'Écart', 'Observations']],
    body: tableRows,
    theme: 'striped',
    headStyles: { fillColor: [99, 102, 255] },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' }
    }
  });

  // Anomalies / Failures
  const nextY = (doc as any).lastAutoTable?.finalY || 150;
  if (failureCmds.length > 0) {
    doc.setFontSize(14);
    doc.text("Anomalies & Echecs du Jour", 20, nextY + 15);
    
    const failureRows = failureCmds.map((c: any) => [
      c.id.substring(0, 8).toUpperCase(),
      c.nom_client || "Client",
      c.statut_commande,
      c.commentaire_agent || "-"
    ]);

    doc.autoTable({
      startY: nextY + 20,
      head: [['Réf Cmd', 'Client', 'Statut Critique', 'Motif / Note Agent']],
      body: failureRows,
      theme: 'grid',
      headStyles: { fillColor: [239, 68, 68] }
    });
  }

  doc.save(`Rapport_Analytique_${dateString}_GomboSwift.pdf`);
};
