import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
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

  const doc = new jsPDF('l', 'mm', 'a4') as jsPDFWithPlugin;
  const pageWidth = doc.internal.pageSize.width;
  const greyTheme: [number, number, number] = [30, 41, 59]; // Dark Slate Grey
  
  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.setTextColor(51, 65, 85);
  const displayDate = feuilleRoute.date ? new Date(feuilleRoute.date) : new Date();
  doc.text(`Feuille de route de Livraison - ${format(displayDate, 'yyyy-MM-dd')}`, 15, 20);

  // --- TABLEAU RÉSUMÉ 1: INFOS LIVREUR ---
  const totalObjectif = (commandes || []).reduce((acc, c) => acc + (Number(c.montant_total) || 0), 0);
  
  autoTable(doc, {
    startY: 30,
    margin: { left: 15, right: 15 },
    head: [['Nom & Prénoms', 'Téléphone', 'Nombre de colis', 'Montant Total à encaisser']],
    body: [[
      feuilleRoute.nom_livreur || "Personnel GomboSwift",
      "-", // Telephone if available in user object
      commandes.length.toString(),
      `${totalObjectif.toLocaleString()} F`
    ]],
    theme: 'grid',
    headStyles: { fillColor: greyTheme, fontSize: 10, halign: 'left' },
    styles: { fontSize: 10, cellPadding: 3, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 50 },
      2: { cellWidth: 40 },
      3: { cellWidth: 'auto', fontStyle: 'bold' }
    }
  });

  // --- TABLEAU RÉSUMÉ 2: RÉCONCILIATION ---
  const lastY1 = (doc as any).lastAutoTable.finalY + 8;
  autoTable(doc, {
    startY: lastY1,
    margin: { left: 15, right: 15 },
    head: [['Colis Retournés', 'Colis Livrés', 'Somme à verser', 'Reste']],
    body: [['0', '0', '0 F', '0 F']], // Placeholders for manual completion or future logic
    theme: 'grid',
    headStyles: { fillColor: greyTheme, fontSize: 10, halign: 'left' },
    styles: { fontSize: 10, cellPadding: 3, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 85 },
      1: { cellWidth: 65 },
      2: { cellWidth: 85 },
      3: { cellWidth: 'auto' }
    }
  });

  // --- TABLEAU PRINCIPAL: DÉTAILS COMMANDES ---
  const lastY2 = (doc as any).lastAutoTable.finalY + 12;
  const tableRows = (commandes || []).map((c) => {
    const itemsStr = (c.lignes || []).map((l: LigneCommande) => 
      `${l.nom_produit} (x${l.quantite})`
    ).join('\n');
    
    const puStr = (c.lignes || []).map((l: LigneCommande) => 
       `${(l.prix_unitaire || 0).toLocaleString()} F`
    ).join('\n');

    const qtyStr = (c.lignes || []).map((l: LigneCommande) => 
       `${l.quantite}`
    ).join('\n');
    
    return [
      `#${(c.id || "").substring(0, 8).toUpperCase()}`,
      itemsStr || "SANS ARTICLES",
      " ", // Taille/Colis
      c.nom_client || "Client",
      puStr || "0 F",
      `${(c.frais_livraison || 0).toLocaleString()} F`,
      qtyStr || "0",
      `${(c.montant_total || 0).toLocaleString()} F`,
      c.telephone_client || "-",
      c.commune_livraison || "-",
      " " // Observation
    ];
  });

  autoTable(doc, {
    startY: lastY2,
    margin: { left: 15, right: 15 },
    head: [[
      'N° commandes', 
      'Articles commandés', 
      'Taille/Colis', 
      'Client', 
      'Prix unitaire', 
      'Livraison', 
      'Quantité', 
      'Net à payer', 
      'Numéro du Client', 
      'Lieu de livraison', 
      'Observation'
    ]],
    body: tableRows,
    theme: 'grid',
    headStyles: { fillColor: greyTheme, fontSize: 8, halign: 'left' },
    styles: { fontSize: 8, cellPadding: 3, textColor: [30, 41, 59] },
    columnStyles: {
      0: { cellWidth: 25 }, // N°
      1: { cellWidth: 60 }, // Articles
      2: { cellWidth: 20 }, // Taille
      3: { cellWidth: 25 }, // Client
      4: { cellWidth: 20 }, // P.U.
      5: { cellWidth: 20 }, // Livraison
      6: { cellWidth: 15 }, // Qty
      7: { cellWidth: 25, fontStyle: 'bold' }, // Net
      8: { cellWidth: 25 }, // Tel
      9: { cellWidth: 25 }, // Lieu
      10: { cellWidth: 'auto' } // Observation
    }
  });

  const finalY = (doc as any).lastAutoTable.finalY;
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text("Signature Livreur", 15, finalY + 15);
  doc.text("Cachet Logistique", pageWidth - 15, finalY + 15, { align: 'right' });

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
    const failureCmds = (data.commandes || []).filter((c: any) => !['terminee', 'livree', 'en_cours_livraison'].includes(c.statut_commande));
    
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
    doc.text(`CA Produits Net: ${totalNetProduits.toLocaleString()}`, 25, 63);
    doc.text(`Logistique: ${totalFraisLivraison.toLocaleString()}`, 25, 73);
    doc.text(`Total Encaissé: ${totalEncaisseBrut.toLocaleString()}`, pageWidth - 25, 63, { align: 'right' });
    doc.text(`Taux de Succès: ${successRate.toFixed(1)}%`, pageWidth - 25, 73, { align: 'right' });

    // Detailed Table
    doc.setFontSize(11);
    doc.text("Détails des Opérations de Caisse", 20, 100);

    const tableRows = (data.retours || []).map((r: any) => {
      const frId = String(r.feuille_route_id || "");
      return [
        frId ? `#${frId.substring(0, 8).toUpperCase()}` : "N/A",
        r.montant_remis_par_livreur?.toLocaleString() || "0",
        r.montant_attendu?.toLocaleString() || "0",
        r.ecart?.toLocaleString() || "0",
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
        1: { halign: 'right' },
        2: { halign: 'right' },
        3: { halign: 'right' }
      }
    });

    // Anomalies / Failures
    const nextY = (doc as any).lastAutoTable?.finalY || 150;
    if (failureCmds.length > 0) {
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Anomalies & Echecs du Jour", 20, nextY + 15);
      
      const failureRows = failureCmds.map((c: any) => {
        const cId = String(c.id || "");
        return [
          cId ? cId.substring(0, 8).toUpperCase() : "N/A",
          c.nom_client || "Client",
          c.statut_commande || "Inconnu",
          c.commentaire_agent || "-"
        ];
      });

      autoTable(doc, {
        startY: nextY + 20,
        head: [['Réf Cmd', 'Client', 'Statut Critique', 'Motif / Note Agent']],
        body: failureRows,
        theme: 'grid',
        headStyles: { fillColor: [239, 68, 68] }
      });
    }

    doc.save(`Rapport_Analytique_${dateString || 'journee'}_GomboSwift.pdf`);
  } catch (err) {
    console.error("Critical error inside generateAnalyticalReportPDF:", err);
    throw err;
  }
};
