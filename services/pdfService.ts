
import { jsPDF } from 'jspdf';

export const generatePdfFromText = (text: string, fileName: string) => {
  const doc = new jsPDF();

  // Basic styling
  doc.setFont('Helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(40);

  // Split the text into lines and add to the PDF
  const lines = doc.splitTextToSize(text, 180); // 180 is the max width
  doc.text(lines, 15, 20);

  // Trigger download
  doc.save(`${fileName}.pdf`);
};
